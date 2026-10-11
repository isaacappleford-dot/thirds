import type { LookParams } from '../config/looks';
import { buildLUT } from './curves';
import { BLUR, BRIGHT, LOOK, VERT } from './shaders';
import { grainScale, hexToRgb, tintOffset, whiteBalanceGains } from './uniforms';

/** Halation is computed at this fixed working size so preview and export match. */
export const HALATION_SIZE = 384;

type Program = { prog: WebGLProgram; u: Record<string, WebGLUniformLocation | null> };

interface Target {
  tex: WebGLTexture;
  fb: WebGLFramebuffer;
  w: number;
  h: number;
}

export class WebGLUnavailableError extends Error {}

/**
 * WebGL2 look renderer. One instance per canvas; call setSource() once per
 * photo, then render() as often as needed (slider moves, look changes).
 */
export class LookRenderer {
  readonly canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext;
  private look: Program;
  private bright: Program;
  private blur: Program;
  private vao: WebGLVertexArrayObject;
  private src: WebGLTexture | null = null;
  private halSrc: WebGLTexture | null = null;
  private lut: WebGLTexture;
  private lutKey = '';
  private halA: Target | null = null;
  private halB: Target | null = null;
  private halKey = '';
  private srcW = 0;
  private srcH = 0;
  private lost = false;

  constructor(canvas?: HTMLCanvasElement) {
    this.canvas = canvas ?? document.createElement('canvas');
    const gl = this.canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
    });
    if (!gl) throw new WebGLUnavailableError('WebGL2 is not available');
    this.gl = gl;
    this.canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.lost = true;
    });
    this.look = this.program(LOOK);
    this.bright = this.program(BRIGHT);
    this.blur = this.program(BLUR);
    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    for (const p of [this.look, this.bright, this.blur]) {
      const loc = gl.getAttribLocation(p.prog, 'aPos');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    }
    this.lut = this.texture();
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  }

  get isLost() {
    return this.lost || this.gl.isContextLost();
  }

  get maxTextureSize(): number {
    return this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE);
  }

  private program(frag: string): Program {
    const gl = this.gl;
    const compile = (type: number, srcText: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, srcText);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) ?? 'shader error');
      return sh;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, frag));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? 'link error');
    const u: Program['u'] = {};
    const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS) as number;
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(prog, i);
      if (info) u[info.name] = gl.getUniformLocation(prog, info.name);
    }
    return { prog, u };
  }

  private texture(): WebGLTexture {
    const gl = this.gl;
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  private target(w: number, h: number): Target {
    const gl = this.gl;
    const tex = this.texture();
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    const fb = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { tex, fb, w, h };
  }

  private freeTarget(t: Target | null) {
    if (!t) return;
    this.gl.deleteTexture(t.tex);
    this.gl.deleteFramebuffer(t.fb);
  }

  /**
   * Upload the photo. `halationSource` is a small copy (long side ≈ HALATION_SIZE)
   * of the same photo; using it for the glow keeps preview and export identical.
   */
  setSource(source: TexImageSource & { width: number; height: number }, halationSource: TexImageSource & { width: number; height: number }) {
    const gl = this.gl;
    const max = this.maxTextureSize;
    if (source.width > max || source.height > max) throw new Error(`Image exceeds MAX_TEXTURE_SIZE (${max})`);
    if (this.src) gl.deleteTexture(this.src);
    if (this.halSrc) gl.deleteTexture(this.halSrc);
    this.src = this.texture();
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, source);
    this.halSrc = this.texture();
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, halationSource);
    this.srcW = source.width;
    this.srcH = source.height;
    this.halKey = '';
    const s = HALATION_SIZE / Math.max(source.width, source.height);
    const hw = Math.max(8, Math.round(source.width * s));
    const hh = Math.max(8, Math.round(source.height * s));
    if (!this.halA || this.halA.w !== hw || this.halA.h !== hh) {
      this.freeTarget(this.halA);
      this.freeTarget(this.halB);
      this.halA = this.target(hw, hh);
      this.halB = this.target(hw, hh);
    }
  }

  get sourceSize() {
    return { width: this.srcW, height: this.srcH };
  }

  private draw() {
    this.gl.bindVertexArray(this.vao);
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
  }

  private bindTex(unit: number, tex: WebGLTexture) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
  }

  /** Build the blurred-highlights texture (cached per threshold/radius). */
  private halation(p: LookParams): WebGLTexture | null {
    const gl = this.gl;
    const a = this.halA!;
    const b = this.halB!;
    const key = `${p.halation.threshold}|${p.halation.radius}`;
    if (this.halKey === key) return a.tex;
    if (p.halation.amount <= 0) return null;

    gl.viewport(0, 0, a.w, a.h);
    gl.useProgram(this.bright.prog);
    gl.uniform1f(this.bright.u.uToTexture, 1);
    gl.uniform1f(this.bright.u.uThreshold, p.halation.threshold);
    gl.uniform1i(this.bright.u.uSrc, 0);
    this.bindTex(0, this.halSrc!);
    gl.bindFramebuffer(gl.FRAMEBUFFER, a.fb);
    this.draw();

    // Two Gaussian passes per axis: a tight core and a wide bloom.
    const radiusPx = p.halation.radius * HALATION_SIZE;
    gl.useProgram(this.blur.prog);
    gl.uniform1f(this.blur.u.uToTexture, 1);
    gl.uniform1i(this.blur.u.uSrc, 0);
    for (const scale of [0.35, 1]) {
      const r = (radiusPx * scale) / 3.23;
      gl.bindFramebuffer(gl.FRAMEBUFFER, b.fb);
      this.bindTex(0, a.tex);
      gl.uniform2f(this.blur.u.uDir, r / a.w, 0);
      this.draw();
      gl.bindFramebuffer(gl.FRAMEBUFFER, a.fb);
      this.bindTex(0, b.tex);
      gl.uniform2f(this.blur.u.uDir, 0, r / a.h);
      this.draw();
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.halKey = key;
    return a.tex;
  }

  /** Render the photo with a look at width×height into this.canvas. */
  render(p: LookParams, intensity: number, seed: number, width: number, height: number) {
    if (!this.src) throw new Error('No source');
    const gl = this.gl;
    width = Math.max(1, Math.round(width));
    height = Math.max(1, Math.round(height));

    const lutKey = JSON.stringify(p.curves);
    if (lutKey !== this.lutKey) {
      gl.bindTexture(gl.TEXTURE_2D, this.lut);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, buildLUT(p.curves));
      this.lutKey = lutKey;
    }
    const hal = this.halation(p);

    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    // The browser may clamp a huge drawing buffer; render into what we actually got.
    const outW = gl.drawingBufferWidth;
    const outH = gl.drawingBufferHeight;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, outW, outH);
    const L = this.look;
    gl.useProgram(L.prog);
    gl.uniform1f(L.u.uToTexture, 0);
    gl.uniform1i(L.u.uSrc, 0);
    gl.uniform1i(L.u.uLut, 1);
    gl.uniform1i(L.u.uHal, 2);
    this.bindTex(0, this.src);
    this.bindTex(1, this.lut);
    this.bindTex(2, hal ?? this.halA!.tex);

    gl.uniform3fv(L.u.uWB, whiteBalanceGains(p.temperature, p.tint));
    gl.uniform1f(L.u.uExposure, p.exposure);
    gl.uniform1f(L.u.uMono, p.mono ? 1 : 0);
    gl.uniform3fv(L.u.uMonoW, p.mono ?? [0.2126, 0.7152, 0.0722]);
    gl.uniform1f(L.u.uSat, p.saturation);
    gl.uniform1f(L.u.uVib, p.vibrance);
    gl.uniform1f(L.u.uHue, p.hueShift);
    gl.uniform3fv(L.u.uShadowOff, tintOffset(p.split.shadows, p.split.shadowAmount));
    gl.uniform3fv(L.u.uHighOff, tintOffset(p.split.highlights, p.split.highlightAmount));
    gl.uniform1f(L.u.uBalance, p.split.balance);
    gl.uniform1f(L.u.uFade, p.fade);
    gl.uniform1f(L.u.uHalAmount, hal ? p.halation.amount : 0);
    gl.uniform3fv(L.u.uHalColor, hexToRgb(p.halation.color));
    gl.uniform1f(L.u.uVig, p.vignette.amount);
    gl.uniform1f(L.u.uVigMid, p.vignette.midpoint);
    gl.uniform1f(L.u.uVigFeather, p.vignette.feather);
    const g = grainScale(Math.min(outW, outH), p.grain.size, p.grain.amount);
    gl.uniform1f(L.u.uGrainAmp, g.amp);
    gl.uniform1f(L.u.uGrainCell, g.cellPx);
    gl.uniform1ui(L.u.uSeed, seed >>> 0);
    gl.uniform2f(L.u.uOutSize, outW, outH);
    gl.uniform1f(L.u.uIntensity, intensity);
    this.draw();
  }

  /** Free GPU memory and the canvas backing store. */
  dispose() {
    const gl = this.gl;
    if (this.src) gl.deleteTexture(this.src);
    if (this.halSrc) gl.deleteTexture(this.halSrc);
    gl.deleteTexture(this.lut);
    this.freeTarget(this.halA);
    this.freeTarget(this.halB);
    this.src = this.halSrc = null;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    this.canvas.width = 0;
    this.canvas.height = 0;
  }
}

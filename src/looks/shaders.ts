export const VERT = `#version 300 es
in vec2 aPos;
uniform float uToTexture;
out vec2 vUv;
void main() {
  // v = 0 is the TOP of the image (sources are uploaded top-down). Drawing to the
  // canvas puts the top at clip y = +1; drawing into a framebuffer texture we keep
  // texture rows in the same order as the source, so passes chain without flips.
  vUv = vec2(aPos.x * 0.5 + 0.5, uToTexture > 0.5 ? aPos.y * 0.5 + 0.5 : 0.5 - aPos.y * 0.5);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

/** Bright-pass: keeps only highlights, for halation. Rendered at a small fixed size. */
export const BRIGHT = `#version 300 es
precision highp float;
uniform sampler2D uSrc;
uniform float uThreshold;
in vec2 vUv;
out vec4 o;
void main() {
  vec3 c = texture(uSrc, vUv).rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float w = smoothstep(uThreshold, 1.0, l);
  o = vec4(c * w, 1.0);
}`;

/** Separable 9-tap Gaussian using linear-filter tricks (5 fetches). */
export const BLUR = `#version 300 es
precision highp float;
uniform sampler2D uSrc;
uniform vec2 uDir; // texel step * radius scale
in vec2 vUv;
out vec4 o;
void main() {
  vec3 c = texture(uSrc, vUv).rgb * 0.2270270270;
  c += texture(uSrc, vUv + uDir * 1.3846153846).rgb * 0.3162162162;
  c += texture(uSrc, vUv - uDir * 1.3846153846).rgb * 0.3162162162;
  c += texture(uSrc, vUv + uDir * 3.2307692308).rgb * 0.0702702703;
  c += texture(uSrc, vUv - uDir * 3.2307692308).rgb * 0.0702702703;
  o = vec4(c, 1.0);
}`;

/**
 * The look pipeline, in order:
 * white balance → B&W mix → tone curves (LUT) → saturation/vibrance → hue →
 * split toning → fade → halation (screen) → vignette → grain → intensity mix.
 */
export const LOOK = `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D uSrc;
uniform sampler2D uLut;
uniform sampler2D uHal;
uniform vec3 uWB;
uniform float uExposure;
uniform float uMono;
uniform vec3 uMonoW;
uniform float uSat;
uniform float uVib;
uniform float uHue;
uniform vec3 uShadowOff;
uniform vec3 uHighOff;
uniform float uBalance;
uniform float uFade;
uniform float uHalAmount;
uniform vec3 uHalColor;
uniform float uVig;
uniform float uVigMid;
uniform float uVigFeather;
uniform float uGrainAmp;
uniform float uGrainCell;
uniform uint uSeed;
uniform vec2 uOutSize;
uniform float uIntensity;
in vec2 vUv;
out vec4 o;

const vec3 LUM = vec3(0.2126, 0.7152, 0.0722);

uint hash(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v.x ^ v.y ^ v.z;
}
float rnd(ivec2 p, uint k) { return float(hash(uvec3(uvec2(p), uSeed ^ k)) & 0xffffffu) / 16777215.0; }
// Roughly Gaussian (sum of two uniforms), mean 0.
float gnoise(ivec2 p) { return rnd(p, 0x9e37u) + rnd(p, 0x7f4au) - 1.0; }
float grainAt(vec2 px) {
  if (uGrainCell <= 1.0) return gnoise(ivec2(floor(px)));
  vec2 g = px / uGrainCell;
  vec2 i = floor(g);
  vec2 f = g - i;
  f = f * f * (3.0 - 2.0 * f);
  ivec2 ii = ivec2(i);
  float a = gnoise(ii);
  float b = gnoise(ii + ivec2(1, 0));
  float c = gnoise(ii + ivec2(0, 1));
  float d = gnoise(ii + ivec2(1, 1));
  // Interpolation shrinks variance; compensate so size doesn't change strength.
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y) * 1.6;
}

vec3 hueRotate(vec3 c, float deg) {
  float a = radians(deg);
  float cs = cos(a), sn = sin(a);
  mat3 toYIQ = mat3(0.299, 0.596, 0.211, 0.587, -0.274, -0.523, 0.114, -0.322, 0.312);
  mat3 toRGB = mat3(1.0, 1.0, 1.0, 0.956, -0.272, -1.106, 0.621, -0.647, 1.703);
  vec3 yiq = toYIQ * c;
  yiq.yz = mat2(cs, sn, -sn, cs) * yiq.yz;
  return toRGB * yiq;
}

float lut(float v, int ch) {
  vec4 t = texture(uLut, vec2(clamp(v, 0.0, 1.0) * (255.0 / 256.0) + 0.5 / 256.0, 0.5));
  return ch == 0 ? t.r : ch == 1 ? t.g : t.b;
}

void main() {
  vec3 src = texture(uSrc, vUv).rgb;

  // White balance + exposure in (approximately) linear light.
  vec3 c = pow(src, vec3(2.2)) * uWB * exp2(uExposure);
  c = pow(clamp(c, 0.0, 1.0), vec3(1.0 / 2.2));

  // Black & white channel mix.
  c = mix(c, vec3(dot(c, uMonoW)), uMono);

  // Per-channel tone curves.
  c = vec3(lut(c.r, 0), lut(c.g, 1), lut(c.b, 2));

  // Saturation + vibrance.
  float l = dot(c, LUM);
  float chroma = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
  c = mix(vec3(l), c, uSat * (1.0 + uVib * (1.0 - chroma)));

  // Hue.
  if (abs(uHue) > 0.01) c = hueRotate(c, uHue);

  // Split toning: shadows and highlights pushed towards their tints.
  l = clamp(dot(c, LUM), 0.0, 1.0);
  float ws = 1.0 - smoothstep(0.0, 0.55 + uBalance, l);
  float wh = smoothstep(0.45 + uBalance, 1.0, l);
  c += uShadowOff * ws + uHighOff * wh;

  // Fade: lift the blacks.
  c = uFade + c * (1.0 - uFade);

  // Halation: blurred highlights, tinted red-orange, screen-blended.
  vec3 h = texture(uHal, vUv).rgb;
  vec3 hal = clamp(dot(h, LUM) * uHalColor * uHalAmount * 1.6, 0.0, 1.0);
  c = 1.0 - (1.0 - clamp(c, 0.0, 1.0)) * (1.0 - hal);

  // Vignette (follows the frame's shape; corners = 1).
  float d = length((vUv - 0.5) * 2.0) / 1.41421356;
  c *= 1.0 - uVig * smoothstep(uVigMid, uVigMid + uVigFeather, d);

  // Grain: strongest in the midtones, lighter in deep shadows and highlights.
  l = clamp(dot(c, LUM), 0.0, 1.0);
  float lw = 0.35 + 0.65 * (4.0 * l * (1.0 - l));
  c += grainAt(vUv * uOutSize) * uGrainAmp * lw;

  o = vec4(mix(src, clamp(c, 0.0, 1.0), uIntensity), 1.0);
}`;

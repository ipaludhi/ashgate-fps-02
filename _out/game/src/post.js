
import * as THREE from 'three';
const VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
function shader(frag, uniforms) {
  return new THREE.ShaderMaterial({
    uniforms, vertexShader: VERT, fragmentShader: frag, depthTest: false, depthWrite: false,
  });
}
const brightFrag = `
  uniform sampler2D tIn; uniform float knee; varying vec2 vUv;
  void main(){
    vec3 c = texture2D(tIn, vUv).rgb;
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    float k = smoothstep(0.74, 0.74 + knee, l);
    gl_FragColor = vec4(c * k, 1.0);
  }`;
const blurFrag = `
  uniform sampler2D tIn; uniform vec2 dir; varying vec2 vUv;
  void main(){
    vec3 s = texture2D(tIn, vUv).rgb * 0.2270;
    s += texture2D(tIn, vUv + dir * 1.3846).rgb * 0.3162;
    s += texture2D(tIn, vUv - dir * 1.3846).rgb * 0.3162;
    s += texture2D(tIn, vUv + dir * 3.2308).rgb * 0.0703;
    s += texture2D(tIn, vUv - dir * 3.2308).rgb * 0.0703;
    gl_FragColor = vec4(s, 1.0);
  }`;
const compFrag = `
  uniform sampler2D tScene; uniform sampler2D tBloom; uniform float bloom; uniform float vig; varying vec2 vUv;
  vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
  void main(){
    vec3 c = texture2D(tScene, vUv).rgb;
    c += texture2D(tBloom, vUv).rgb * bloom;
    c = aces(c * 1.48);
    vec2 q = vUv - 0.5;
    float v = smoothstep(1.04, 0.34, length(q));
    c *= mix(1.0, v, vig);
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c *= mix(vec3(0.92, 0.96, 1.06), vec3(1.12, 0.99, 0.86), smoothstep(0.10, 0.64, l));
    c = pow(c + 0.008, vec3(1.0 / 2.2));
    gl_FragColor = vec4(c, 1.0);
  }`;
export class PostFX {
  constructor(renderer) {
    this.renderer = renderer;
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    this.scene = new THREE.Scene();
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
    this.brightMat = shader(brightFrag, { tIn: { value: null }, knee: { value: 0.60 } });
    this.blurMat = shader(blurFrag, { tIn: { value: null }, dir: { value: new THREE.Vector2(1, 0) } });
    this.compMat = shader(compFrag, {
      tScene: { value: null }, tBloom: { value: null }, bloom: { value: 1.0 }, vig: { value: 0.34 },
    });
    this.setSize(size.x, size.y);
  }
  setSize(w, h) {
    this.w = w; this.h = h;
    if (this.rt) { this.rt.dispose(); this.rtA.dispose(); this.rtB.dispose(); }
    const opts = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
    this.rt = new THREE.WebGLRenderTarget(w, h, { ...opts, samples: 4 });
    const bw = Math.max(1, w >> 1), bh = Math.max(1, h >> 1);
    this.rtA = new THREE.WebGLRenderTarget(bw, bh, opts);
    this.rtB = new THREE.WebGLRenderTarget(bw, bh, opts);
  }
  blit(mat, target) {
    this.quad.material = mat;
    this.renderer.setRenderTarget(target);
    this.renderer.clear();
    this.renderer.render(this.scene, this.cam);
  }
  render(scene, camera) {
    const r = this.renderer;
    r.setRenderTarget(this.rt);
    r.render(scene, camera);
    this.brightMat.uniforms.tIn.value = this.rt.texture;
    this.blit(this.brightMat, this.rtA);
    this.blurMat.uniforms.tIn.value = this.rtA.texture;
    this.blurMat.uniforms.dir.value.set(1 / this.rtA.width, 0);
    this.blit(this.blurMat, this.rtB);
    this.blurMat.uniforms.tIn.value = this.rtB.texture;
    this.blurMat.uniforms.dir.value.set(0, 1 / this.rtB.height);
    this.blit(this.blurMat, this.rtA);
    this.compMat.uniforms.tScene.value = this.rt.texture;
    this.compMat.uniforms.tBloom.value = this.rtA.texture;
    this.blit(this.compMat, null);
  }
}
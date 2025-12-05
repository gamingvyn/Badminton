// loader.js - Professional asset loader for images + audio with progress events

export default class Loader {
  constructor() {
    this.assets = {
      images: {},
      audio: {}
    };

    this.total = 0;
    this.loaded = 0;

    this.onProgress = null; // callback(percent)
  }

  // --------------------------------------------
  // Public Load Function
  // --------------------------------------------
  async load({ images = {}, audio = {} }) {
    const imageKeys = Object.keys(images);
    const audioKeys = Object.keys(audio);

    this.total = imageKeys.length + audioKeys.length;
    this.loaded = 0;

    const imagePromises = imageKeys.map(key => this.loadImage(key, images[key]));
    const audioPromises = audioKeys.map(key => this.loadAudio(key, audio[key]));

    await Promise.all([...imagePromises, ...audioPromises]);
  }

  // --------------------------------------------
  // Load Image
  // --------------------------------------------
  loadImage(key, src) {
    return new Promise(resolve => {
      const img = new Image();
      img.src = src;

      img.onload = () => {
        this.assets.images[key] = img;
        this.increment();
        resolve();
      };

      img.onerror = () => {
        console.warn("Failed to load image:", src);
        this.increment();
        resolve();
      };
    });
  }

  // --------------------------------------------
  // Load Audio
  // --------------------------------------------
  loadAudio(key, src) {
    return new Promise(resolve => {
      const audio = new Audio();
      audio.src = src;

      audio.oncanplaythrough = () => {
        this.assets.audio[key] = audio;
        this.increment();
        resolve();
      };

      audio.onerror = () => {
        console.warn("Failed to load audio:", src);
        this.increment();
        resolve();
      };
    });
  }

  // --------------------------------------------
  // Update Progress
  // --------------------------------------------
  increment() {
    this.loaded++;
    if (this.onProgress) {
      const percent = (this.loaded / this.total) * 100;
      this.onProgress(percent);
    }
  }
}

import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class InMemoryImageStore {

  private data = {};

  constructor(
  ) {
  }
  
  getLabels() {
    return Object.keys(this.data).sort();
  }

  hasLabel(label) {
    return this.data[label] !== undefined;
  }

  addLabel(label) {
    if (!label || this.data[label]) {
      throw new Error(`Label ${label} already exists`);
    }

    this.data[label] = [];
  }

  hasOnePicturePerLabel() {
    return this.getLabels().every(label => this.data[label].length);
  }

  storeImage(label, imageData, base64) {
    this.data[label].push({ imageData, base64 });
  }

  getData() {
    return this.data;
  }

  setData(data) {
    this.data = data;
  }

  getDataAsImageData() {
    const dataAsImageData = this.getLabels().reduce((images, label) => {
      const labelImages = this.data[label].map(image => ({ imageData: image.imageData, label }));
      images = images.concat(labelImages);
      return images;
    }, []);

    return dataAsImageData;
  }
}
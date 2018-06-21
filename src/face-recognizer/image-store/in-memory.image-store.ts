import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class InMemoryImageStore {

  data = {};

  constructor(
  ) {
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

  getLabels() {
    return Object.keys(this.data);
  }

  storeImage(label, imageData, b64) {
    this.data[label].push({ imageData, b64 });
  }

  getDataAsImageData() {
    const dataAsImageData = Object.keys(this.data).reduce((imageData, label) => {
      imageData[label] = this.data[label].map(image => image.imageData);
      return imageData;
    }, {});

    return dataAsImageData;
  }
}
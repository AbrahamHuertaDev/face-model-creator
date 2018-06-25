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
    return Object.keys(this.data);
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
    const dataAsImageData = Object.keys(this.data).reduce((imageData, label) => {
      imageData[label] = this.data[label].map(image => image.imageData);
      return imageData;
    }, {});

    return dataAsImageData;
  }
}
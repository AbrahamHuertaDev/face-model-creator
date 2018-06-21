import { Injectable } from '@angular/core';

import { ShapeAPIFaceDetector } from './face-detector/shape-api.face-detector';
import { TensorflowImageClassifier } from './image-classifier/tensorflow.image-classifier';
import { InMemoryImageStore } from './image-store/in-memory.image-store';
import { ZipImageLoader } from './image-loader/zip.image-loader';

@Injectable({
  providedIn: 'root' 
})
export class FaceRecognizerInteractor {

  constructor(
    private faceDetector: ShapeAPIFaceDetector,
    public imageClassifier: TensorflowImageClassifier,
    public imageStore: InMemoryImageStore,
    private imageLoader: ZipImageLoader
  ) {
  }

  public async detectFaces(drawable) {
    const faces = await this.faceDetector.detect(drawable);
    return faces;
  }

  public addLabel(label) {
    if(!label || this.imageStore.hasLabel(label)) {
      return;
    }
    
    this.imageStore.addLabel(label);
  }

  public storeImage(label, imageData, dataURL) {
    const b64 = dataURL.split(',').pop();
    this.imageStore.storeImage(label, imageData, b64);
  }

  public async predict(face) {
    return await this.imageClassifier.predict(face);
  }

  public trainModel() {
    return this.imageClassifier.trainModel(this.imageStore.getDataAsImageData());
  }

  public saveModel() {
    this.imageClassifier.saveHeadModel();
  }
  
  public async loadModel(modelData, weights) {
    this.imageClassifier.labels = Object.keys(this.imageStore.data);
    this.imageClassifier.loadHeadModel(modelData, weights);
  }

  public async loadDataFromZIP(file) {
    this.imageStore.data = await this.imageLoader.loadDataFromZIP(file);
  }

  public downloadDataAsZIP() {
    this.imageLoader.downloadDataAsZIP(this.imageStore.data);
  }
}
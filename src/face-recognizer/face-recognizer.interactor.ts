import { FaceDetector, Face } from "./face-recognizer.interfaces";

import { Injectable } from '@angular/core';

import { ShapeAPIFaceDetector } from './face-detector/shape-api.face-detector';
import { TrackingJSFaceDetector } from './face-detector/tracking-js.face-detector';

import { TensorflowImageClassifier } from './image-classifier/tensorflow.image-classifier';
import { InMemoryImageStore } from './image-store/in-memory.image-store';
import { ZipImageLoader } from './image-loader/zip.image-loader';


@Injectable({
  providedIn: 'root'
})
export class FaceRecognizerInteractor {

  faceDetector: FaceDetector;

  constructor(
    shapeAPIFaceDetector: ShapeAPIFaceDetector,
    trackingJSFaceDetector: TrackingJSFaceDetector,
    private imageClassifier: TensorflowImageClassifier,
    private imageStore: InMemoryImageStore,
    private imageLoader: ZipImageLoader
  ) {
    try {
      shapeAPIFaceDetector.init();
      this.faceDetector = shapeAPIFaceDetector;
    } catch (error) {
      trackingJSFaceDetector.init();
      this.faceDetector = trackingJSFaceDetector;
    }
  }

  public detectFaces(drawable) : Promise<Face[]> {
    const faces = this.faceDetector.detect(drawable);
    return faces;
  }

  public addLabel(label) {
    if (!label || this.imageStore.hasLabel(label)) {
      return;
    }

    this.imageStore.addLabel(label);
  }

  public storeImage(label, imageData, dataURL) {
    const base64 = dataURL.split(',').pop();
    this.imageStore.storeImage(label, imageData, base64);
  }

  public async predict(face) {
    return await this.imageClassifier.predict(face);
  }

  public getTrainingObservable() {
    return this.imageClassifier.getTrainingObservable();
  }

  public trainModel() {
    return this.imageClassifier.trainModel(this.imageStore.getDataAsImageData());
  }

  public async exportModel() {
    await this.imageLoader.exportLabels(this.imageStore.getData());
    await this.imageClassifier.exportModel();
  }

  public async importModel(modelData, weights, labels) {
    await this.loadData(labels);
    await this.imageClassifier.loadHeadModel(modelData, weights);
  }

  public async loadData(file) {
    const loadedData = await this.imageLoader.loadData(file);
    this.imageStore.setData(loadedData);
  }

  public exportData() {
    return this.imageLoader.exportData(this.imageStore.getData());
  }
}
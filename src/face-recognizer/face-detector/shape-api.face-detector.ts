import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root' 
})
export class ShapeAPIFaceDetector {

  faceDetector;
  faceDetectorAvailable = true;

  constructor() {
    this.init();
  }

  private async init() {
    try {
      this.faceDetector = new window['FaceDetector']({ fastMode: true });
    } catch (error) {
      this.faceDetectorAvailable = false;
      return;
    }
  }

  public async detect(drawable) {
    const faces = await this.faceDetector.detect(drawable);
    return faces;
  }
}

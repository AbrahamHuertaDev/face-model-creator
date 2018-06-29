import { Injectable } from '@angular/core';

import { FaceDetector, Face } from "../face-recognizer.interfaces";

@Injectable({
  providedIn: 'root'
})
export class ShapeAPIFaceDetector implements FaceDetector {

  faceDetector;

  public async init() {
    this.faceDetector = new window['FaceDetector']({ fastMode: true, maxDetectedFaces: 5 });
  }

  public stop() {
    return;
  }

  public async detect(drawable): Promise<Face[]> {
    const faces = await this.faceDetector.detect(drawable)
      .catch(() => { throw new Error('Face detection not working') });
    return faces.map(face => face.boundingBox);
  }
} 
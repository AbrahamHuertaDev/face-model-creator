import { Injectable } from '@angular/core';

import { FaceDetector, Face } from "../face-recognizer.interfaces";

@Injectable({
  providedIn: 'root' 
})
export class ShapeAPIFaceDetector implements FaceDetector {

  faceDetector;

  public init() : void {
    this.faceDetector = new window['FaceDetector']({ fastMode: true });
  }

  public async detect(drawable) : Promise<Face[]> {
    const faces = await this.faceDetector.detect(drawable)
      .catch(err => { throw new Error(err) });
    return faces.map(face => face.boundingBox);
  }
}

'use client';

import React from 'react';
import { ReactPhotoSphereViewer } from 'react-photo-sphere-viewer';

interface VirtualTourProps {
  image: string;
}

export default function VirtualTour({ image }: VirtualTourProps) {
  return (
    <ReactPhotoSphereViewer
      src={image}
      height="100%"
      width="100%"
      littlePlanet={false}
      defaultZoomLvl={0} // 0 = maximum zoom out, 50 = default middle, 100 = maximum zoom in
      minFov={30}        // optional: limit how far the user can zoom IN
      maxFov={90}        // optional: limit how far the user can zoom OUT
      navbar={['zoom', 'move', 'download', 'fullscreen']}
    />
  );
}
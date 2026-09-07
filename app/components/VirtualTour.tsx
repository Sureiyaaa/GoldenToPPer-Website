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
      navbar={['zoom', 'move', 'download', 'fullscreen']}
    />
  );
}
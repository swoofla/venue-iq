import React, { useRef, useEffect, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function MaskGenerator() {
  const forestCanvasRef = useRef(null);
  const lakesideCanvasRef = useRef(null);
  const [generated, setGenerated] = useState(false);

  const WIDTH = 1216;
  const HEIGHT = 832;

  useEffect(() => {
    generateMasks();
  }, []);

  const generateMasks = () => {
    // Generate Forest Ceremony Mask
    const forestCanvas = forestCanvasRef.current;
    if (forestCanvas) {
      const ctx = forestCanvas.getContext('2d');
      
      // Black background (preserve)
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      
      // White = editable zone
      ctx.fillStyle = '#FFFFFF';
      
      // Altar area (stone wall + arch zone)
      ctx.beginPath();
      ctx.ellipse(WIDTH/2, HEIGHT * 0.38, WIDTH * 0.28, HEIGHT * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Center aisle on deck
      ctx.beginPath();
      const aisleTopWidth = WIDTH * 0.18;
      const aisleBottomWidth = WIDTH * 0.28;
      const aisleTop = HEIGHT * 0.48;
      const aisleBottom = HEIGHT * 0.98;
      
      ctx.moveTo(WIDTH/2 - aisleTopWidth/2, aisleTop);
      ctx.lineTo(WIDTH/2 + aisleTopWidth/2, aisleTop);
      ctx.lineTo(WIDTH/2 + aisleBottomWidth/2, aisleBottom);
      ctx.lineTo(WIDTH/2 - aisleBottomWidth/2, aisleBottom);
      ctx.closePath();
      ctx.fill();
    }

    // Generate Lakeside Ceremony Mask
    const lakesideCanvas = lakesideCanvasRef.current;
    if (lakesideCanvas) {
      const ctx = lakesideCanvas.getContext('2d');
      
      // Black background (preserve)
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      
      // White = editable zone
      ctx.fillStyle = '#FFFFFF';
      
      // Altar area at base of oak tree
      ctx.beginPath();
      ctx.ellipse(WIDTH/2, HEIGHT * 0.62, WIDTH * 0.22, HEIGHT * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Center grass aisle
      ctx.beginPath();
      const aisleTopWidth = WIDTH * 0.10;
      const aisleBottomWidth = WIDTH * 0.22;
      const aisleTop = HEIGHT * 0.68;
      const aisleBottom = HEIGHT * 0.99;
      
      ctx.moveTo(WIDTH/2 - aisleTopWidth/2, aisleTop);
      ctx.lineTo(WIDTH/2 + aisleTopWidth/2, aisleTop);
      ctx.lineTo(WIDTH/2 + aisleBottomWidth/2, aisleBottom);
      ctx.lineTo(WIDTH/2 - aisleBottomWidth/2, aisleBottom);
      ctx.closePath();
      ctx.fill();
    }

    setGenerated(true);
  };

  const downloadMask = (canvasRef, filename) => {
    const canvas = canvasRef.current;
    if (canvas) {
      const link = document.createElement('a');
      link.download = filename;
      link.href = canvas.toDataURL('image/png');
      link.click();
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-stone-900 mb-2">
          Ceremony Zone Mask Generator
        </h1>
        <p className="text-stone-600 mb-8">
          White areas = where decorations will be added<br/>
          Black areas = protected (tree, sky, chairs, background)
        </p>

        {/* Forest Ceremony Mask */}
        <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-stone-900">Forest Ceremony Deck</h2>
              <p className="text-sm text-stone-500">Covers: stone altar wall + wooden deck aisle</p>
            </div>
            <Button
              onClick={() => downloadMask(forestCanvasRef, 'mask_forest_ceremony.png')}
              className="rounded-full bg-black hover:bg-stone-800"
            >
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
          </div>
          <div className="border border-stone-200 rounded-lg overflow-hidden bg-stone-800">
            <canvas
              ref={forestCanvasRef}
              width={WIDTH}
              height={HEIGHT}
              className="w-full h-auto"
            />
          </div>
        </div>

        {/* Lakeside Ceremony Mask */}
        <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-stone-900">Lakeside Oak Tree Ceremony</h2>
              <p className="text-sm text-stone-500">Covers: tree base altar zone + grass aisle</p>
            </div>
            <Button
              onClick={() => downloadMask(lakesideCanvasRef, 'mask_lakeside_ceremony.png')}
              className="rounded-full bg-black hover:bg-stone-800"
            >
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
          </div>
          <div className="border border-stone-200 rounded-lg overflow-hidden bg-stone-800">
            <canvas
              ref={lakesideCanvasRef}
              width={WIDTH}
              height={HEIGHT}
              className="w-full h-auto"
            />
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
          <h3 className="font-semibold text-amber-900 mb-2">Next Steps</h3>
          <ol className="text-amber-800 text-sm space-y-2 list-decimal list-inside">
            <li>Download both mask images using the buttons above</li>
            <li>Upload them to Base44 file storage</li>
            <li>Copy the uploaded file URLs</li>
            <li>Go to VenueVisualizationPhoto records and set the mask_url field</li>
          </ol>
        </div>

        {generated && (
          <div className="flex items-center justify-center gap-2 mt-6 text-green-600">
            <RefreshCw className="w-4 h-4" />
            <span>Masks generated successfully</span>
          </div>
        )}
      </div>
    </div>
  );
}
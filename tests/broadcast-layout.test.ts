import { expect, it } from "vitest";
import { broadcastFrame, adaptiveBroadcastFrame } from "../src/components/music/broadcast-layout";
it("fits the tallest pair and widest ink without changing scale between frames", () => {
  const systems = [
    { top: 0, bottom: 100, left: 10, right: 610 },
    { top: 140, bottom: 260, left: 0, right: 620 },
    { top: 300, bottom: 460, left: 0, right: 620 },
  ];
  const { scale, margin } = broadcastFrame(systems, 1280, 440);
  expect(320 * scale).toBeLessThanOrEqual(440 - 2 * margin);
  expect(620 * scale).toBeLessThanOrEqual(1280 - 2 * margin);
});
it("enlarges sparse single lines but keeps edge padding", () => {
  const { scale, margin } = broadcastFrame([{ top: 0, bottom: 100, left: 0, right: 250 }], 1280, 440);
  expect(scale).toBeGreaterThan(1);
  expect(100 * scale).toBeCloseTo(440 - 2 * margin);
});
it.each([1,2,3])("balances %i complete systems without clipping ink or exceeding 10 percent growth",count=>{
  const bounds=Array.from({length:count},(_,i)=>({top:i*270,bottom:i*270+130+i*35,left:0,right:600}));
  for(const [width,height] of [[1920,638],[1603,488],[780,420]]){
    const fit=adaptiveBroadcastFrame(bounds,width,height);
    fit.centers!.forEach((c,i)=>expect(c/height).toBeCloseTo(({1:[.5],2:[.32,.68],3:[.22,.5,.78]} as Record<number,number[]>)[count][i]));
    expect(fit.scale).toBeLessThanOrEqual(broadcastFrame(bounds,width,height).scale*1.1);
    bounds.forEach((b,i)=>{
      const half=(b.bottom-b.top)*fit.scale/2;
      expect(fit.centers![i]-half).toBeGreaterThanOrEqual(fit.margin-.001);
      expect(fit.centers![i]+half).toBeLessThanOrEqual(height-fit.margin+.001);
      expect((b.right-b.left)*fit.scale).toBeLessThanOrEqual(width-2*fit.margin+.001);
      if(i)expect(fit.centers![i]-half).toBeGreaterThanOrEqual(fit.centers![i-1]+(bounds[i-1].bottom-bounds[i-1].top)*fit.scale/2+fit.margin-.001);
    });
  }
});
it('preserves natural pair layout for four or more systems',()=>{
  const bounds=Array.from({length:7},(_,i)=>({top:i*220,bottom:i*220+140,left:0,right:600}));
  expect(adaptiveBroadcastFrame(bounds,1600,638)).toEqual({...broadcastFrame(bounds,1600,638),centers:undefined});
});

it('contains the full union when adjacent systems have different overhangs',()=>{
  const bounds=[{left:-100,right:500,top:20,bottom:180},{left:100,right:700,top:0,bottom:300}];
  const {scale}=broadcastFrame(bounds,800,320);
  expect(800*scale).toBeLessThanOrEqual(800-48);
  expect(300*scale).toBeLessThanOrEqual(320-48);
});

it('uses configurable asymmetric padding and height-limited containment',()=>{
  const padding={top:20,bottom:28,left:16,right:24};
  const bounds=[{left:-30,right:970,top:-120,bottom:780}];
  const fit=adaptiveBroadcastFrame(bounds,1920,200,padding);
  expect(fit.scale).toBeCloseTo(152/900);
  expect(fit.centers![0]-450*fit.scale).toBeCloseTo(padding.top);
  expect(fit.centers![0]+450*fit.scale).toBeCloseTo(200-padding.bottom);
});

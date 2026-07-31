import { describe, it, expect } from "vitest";
import { puzzleItems, fingerprintPuzzle } from "../fingerprint";
const cases:any[] = [
 {target:{name:"Tokyo Tower"},locations:[{name:"Eiffel Tower"},{name:"Taj Mahal"},{name:"Tokyo Tower"}]},
 {target:{name:"Tokyo Tower"},locations:[{name:"Tokyo Tower"},{name:"Taj Mahal"},{name:"Eiffel Tower"}]},
 {target:{name:" tokyo   TOWER "},availableLocations:[{name:"Eiffel Tower"}]},
 {availableLocations:[{name:"A"},{name:"B"}]},
 {target:{name:"X"},locations:"notarray"},
 {},
];
const expectedItems = [
 ["tokyo tower","eiffel tower","taj mahal","tokyo tower"],
 ["tokyo tower","eiffel tower","taj mahal","tokyo tower"],
 ["tokyo tower","eiffel tower"],
 ["a","b"],
 ["x"],
 [],
];
describe("waypoint fingerprint matches the daily-mcp.mjs copy",()=>{
 it("produces identical items for every shape",()=>{
  cases.forEach((c,i)=>expect(puzzleItems("waypoint",c),`case ${i}`).toEqual(expectedItems[i]));
 });
 it("a reshuffled bank is the same puzzle",()=>{
  expect(fingerprintPuzzle("waypoint",cases[0])).toBe(fingerprintPuzzle("waypoint",cases[1]));
 });
 it("same bank, different target is a different puzzle",()=>{
  const a={target:{name:"Tokyo Tower"},locations:[{name:"Tokyo Tower"},{name:"Taj Mahal"}]};
  const b={target:{name:"Taj Mahal"},locations:[{name:"Tokyo Tower"},{name:"Taj Mahal"}]};
  expect(fingerprintPuzzle("waypoint",a)).not.toBe(fingerprintPuzzle("waypoint",b));
 });
});

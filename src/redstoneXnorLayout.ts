import pistonLayoutJson from "./redstoneXnorLayouts/piston.json?raw";
import { parseLogicLayoutJson } from "./redstoneLayoutParser";

export const PISTON_XNOR_LAYOUT = parseLogicLayoutJson(pistonLayoutJson, "piston XNOR");

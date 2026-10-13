import dropperHopperLayoutJson from "./redstoneXorLayouts/dropper-hopper.json?raw";
import pistonLayoutJson from "./redstoneXorLayouts/piston.json?raw";
import { parseLogicLayoutJson } from "./redstoneLayoutParser";

export const DROPPER_HOPPER_XOR_LAYOUT = parseLogicLayoutJson(dropperHopperLayoutJson, "dropper-hopper");
export const PISTON_XOR_LAYOUT = parseLogicLayoutJson(pistonLayoutJson, "piston");

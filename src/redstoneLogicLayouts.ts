import type { LogicLayoutPart } from "./redstoneLayoutParser";
import { parseLogicLayoutJson } from "./redstoneLayoutParser";
import layout_notJson from "./redstoneLayouts/not.json?raw";
import layout_orJson from "./redstoneLayouts/or.json?raw";
import layout_norJson from "./redstoneLayouts/nor.json?raw";
import layout_andJson from "./redstoneLayouts/and.json?raw";
import layout_nandJson from "./redstoneLayouts/nand.json?raw";
import layout_xorJson from "./redstoneLayouts/xor.json?raw";
import layout_xnorJson from "./redstoneLayouts/xnor.json?raw";
import layout_implicationJson from "./redstoneLayouts/implication.json?raw";
import layout_muxJson from "./redstoneLayouts/mux.json?raw";
import layout_demuxJson from "./redstoneLayouts/demux.json?raw";
import layout_decoderJson from "./redstoneLayouts/decoder.json?raw";
import layout_half_adderJson from "./redstoneLayouts/half-adder.json?raw";
import layout_full_adderJson from "./redstoneLayouts/full-adder.json?raw";
import layout_majorityJson from "./redstoneLayouts/majority.json?raw";

export type { LogicLayoutPart } from "./redstoneLayoutParser";

export const REDSTONE_LOGIC_LAYOUTS: Record<string, LogicLayoutPart[]> = {
  "NOT": parseLogicLayoutJson(layout_notJson, "NOT"),
  "OR": parseLogicLayoutJson(layout_orJson, "OR"),
  "NOR": parseLogicLayoutJson(layout_norJson, "NOR"),
  "AND": parseLogicLayoutJson(layout_andJson, "AND"),
  "NAND": parseLogicLayoutJson(layout_nandJson, "NAND"),
  "XOR": parseLogicLayoutJson(layout_xorJson, "XOR"),
  "XNOR": parseLogicLayoutJson(layout_xnorJson, "XNOR"),
  "implication": parseLogicLayoutJson(layout_implicationJson, "implication"),
  "mux": parseLogicLayoutJson(layout_muxJson, "mux"),
  "demux": parseLogicLayoutJson(layout_demuxJson, "demux"),
  "decoder": parseLogicLayoutJson(layout_decoderJson, "decoder"),
  "half-adder": parseLogicLayoutJson(layout_half_adderJson, "half-adder"),
  "full-adder": parseLogicLayoutJson(layout_full_adderJson, "full-adder"),
  "majority": parseLogicLayoutJson(layout_majorityJson, "majority"),
};

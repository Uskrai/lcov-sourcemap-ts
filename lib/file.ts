import { LcovBranch, LcovFunc, LcovLine } from "lcov-parse";
import _ from "lodash";

interface OutputHit<T> {
  found: number;
  hit: number;
  details: T[];
}

export class OutputFile {
  functions: OutputHit<LcovFunc> = {
    found: 0,
    hit: 0,
    details: [],
  };
  lines: OutputHit<LcovLine> = {
    found: 0,
    hit: 0,
    details: [],
  };
  branches: OutputHit<LcovBranch> = {
    found: 0,
    hit: 0,
    details: [],
  };
  constructor(public path: string) {}

  addFunction(func: LcovFunc) {
    var functions = this.functions;
    functions.found++;
    functions.hit += func.hit;
    functions.details.push(func);

    return this;
  }

  addLine(line: LcovLine) {
    var lines = this.lines;
    lines.found++;
    lines.hit += line.hit;
    lines.details.push(line);

    return this;
  }

  addBranch(branch: LcovBranch) {
    var branches = this.branches;
    branches.found++;
    branches.hit += branch.taken;
    branches.details.push(branch);

    return this;
  }

  toString() {
    var output = [];

    // Header
    output.push("TN:");
    output.push("SF:" + this.path);

    // Functions
    _.each(this.functions.details, function (func) {
      output.push("FN:" + func.line + "," + func.name);
    });
    output.push("FNF:" + this.functions.found);
    output.push("FNH:" + this.functions.hit);
    _.each(this.functions.details, function (func) {
      output.push("FNDA:" + func.hit + "," + func.name);
    });

    // Lines
    _.each(this.lines.details, function (line) {
      output.push("DA:" + line.line + "," + line.hit);
    });
    output.push("LF:" + this.lines.found);
    output.push("LH:" + this.lines.hit);

    // Branches
    _.each(this.branches.details, function (branch) {
      output.push(
        "BRDA:" +
          branch.line +
          "," +
          branch.block +
          "," +
          branch.branch +
          "," +
          branch.taken
      );
    });
    output.push("BRF:" + this.branches.found);
    output.push("BRH:" + this.branches.hit);

    // Footer
    output.push("end_of_record");

    return output.join("\n");
  }
}

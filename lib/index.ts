"use strict";

import convert from "convert-source-map";
import fs from "fs/promises";
import parse, { LcovFile } from "lcov-parse";
import _ from "lodash";
import path from "path";
import {
  BasicSourceMapConsumer,
  NullableMappedPosition,
  SourceMapConsumer,
} from "source-map";
import { promisify } from "util";
import { OutputFile } from "./file";

// module.exports = module.exports.getLcov = getLcov;
// module.exports.writeLcov = writeLcov;

type SourcemapResolve = (path: string) => string;

export async function getLcov(
  lcov: string,
  sourcemaps: SourcemapResolve,
  sourceDir: string
) {
  let file = await getTransformedFiles(lcov, sourcemaps, sourceDir);

  return getOutputLcov(file, sourceDir);
}

export async function writeLcov(
  lcov: string,
  sourcemaps: SourcemapResolve,
  sourceDir: string,
  outputFile: string
) {
  let data = await getLcov(lcov, sourcemaps, sourceDir);

  return await fs.writeFile(outputFile, data);
  // return getLcov(lcov, sourcemaps, sourceDir).then(function (lcov: LcovFile) {
  //   return await fs.writeFile(outputFile, lcov);
  // });
}

async function getOutputLcov(files: OutputFile[], sourceDir: string) {
  sourceDir = sourceDir || process.cwd();

  const resolver = await Promise.all(
    _.map(files, function (file) {
      // Check if used package tool like webpack or otherwise
      let match = file.path.match(/^\.\/([a-z]*?):\/\/(.*)/i);
      if (match != null) {
        let protocol = match[1],
          bundlerPath = match[2];
        if (protocol != "file" && bundlerPath[0] === "/") {
          bundlerPath = bundlerPath.substring(1);
        }
        file.path = bundlerPath;
      }

      let it = new Promise(async function (
        resolve: (path: OutputFile) => void
      ) {
        let exists = await fs.stat(path.resolve(sourceDir, file.path));

        if (exists != null) {
          resolve(file);
        }
      });

      return it;
    })
  ).then(it => _.filter(it));

  var output: string[] = [];
  _.each(resolver, function (file_1: OutputFile) {
    output.push(file_1.toString());
  });
  return output.join("\n");
}

async function getTransformedFiles(
  lcov: string,
  sourcemaps: SourcemapResolve,
  sourceDir: string
) {
  let data = await getData(lcov, sourcemaps);

  return getData(lcov, sourcemaps).then(function (data) {
    return _.chain(data.lcov)
      .map(function (lcov, key) {
        var sourcemap = data.sourcemap[key];
        if (!sourcemap) {
          throw new Error("Missing sourcemap: " + key);
        }
        return transformLcovMap(lcov, sourcemap, sourceDir);
      })
      .map(function (group) {
        return _.values(group);
      })
      .flatten()
      .value();
  });
}

type OutputMap = { [key: string]: OutputFile };
function transformLcovMap(
  lcov: LcovFile,
  sourcemap: SourcemapFile,
  sourceDir: string
): OutputMap {
  let consumer = sourcemap.consumer;

  let files: OutputMap = {};

  let getFile: (source: NullableMappedPosition) => OutputFile;
  if (!consumer.sourceRoot) {
    // sourcemaps without sourceRoot will be relative to dist
    getFile = function (source: NullableMappedPosition) {
      var fn =
        "." +
        path.sep +
        path.relative(
          sourceDir,
          path.join(path.dirname(sourcemap.path), source.source!)
        );

      return (files[fn] = files[fn] || new OutputFile(fn));
    };
  } else {
    getFile = function (source: NullableMappedPosition) {
      var fn = source.source!.replace(consumer.sourceRoot, "./");

      return (files[fn] = files[fn] || new OutputFile(fn));
    };
  }

  _.each(lcov.functions.details, function (func) {
    var source = consumer.originalPositionFor({
      line: func.line,
      column: 0,
      bias: SourceMapConsumer.LEAST_UPPER_BOUND,
    });

    // Can't find it in source map, fuhgeddaboudit
    if (!source || !source.source) {
      return;
    }

    getFile(source).addFunction({
      name: func.name,
      line: source.line!,
      hit: func.hit,
    });
  });

  _.each(lcov.lines.details, function (line) {
    var source = consumer.originalPositionFor({
      line: line.line,
      column: 0,
      bias: SourceMapConsumer.LEAST_UPPER_BOUND,
    });

    // Can't find it in source map, fuhgeddaboudit
    if (!source || !source.source) {
      return;
    }

    getFile(source).addLine({
      line: source.line!,
      hit: line.hit,
    });
  });

  _.each(lcov.branches.details, function (branch) {
    var source = consumer.originalPositionFor({
      line: branch.line,
      column: 0,
      bias: SourceMapConsumer.LEAST_UPPER_BOUND,
    });

    // Can't find it in source map, fuhgeddaboudit
    if (!source || !source.source) {
      return;
    }

    getFile(source).addBranch({
      block: branch.block,
      line: source.line!,
      branch: branch.branch,
      taken: branch.taken,
    });
  });

  return files;
}

export async function getData(lcovpath: string, sourcemaps: SourcemapResolve) {
  let lcov = await getLcovData(lcovpath);

  let sourcemap = await getSourcemapsData(lcov, sourcemaps);

  return {
    lcov,
    sourcemap,
  };
}

type SourcemapFile = {
  path: string;
  consumer: BasicSourceMapConsumer;
};
type SourcemapMap = {
  [key: string]: SourcemapFile;
};
async function getSourcemapsData(
  lcov: LcovMap,
  sourcemaps: SourcemapResolve
): Promise<SourcemapMap> {
  let sources = Object.entries(lcov).map(async ([lcovpath, _]) => {
    let sourcepath = sourcemaps(lcovpath);
    let file = await fs.readFile(sourcepath);

    let content = (() => {
      if (path.extname(sourcepath) === ".map") {
        return file.toString();
      } else {
        return convert.fromSource(file.toString())?.toObject();
      }
    })();

    return [
      lcovpath,
      {
        path: sourcepath,
        consumer: await SourceMapConsumer.fromSourceMap(content),
      },
    ];
  });

  let objects = await Promise.all(sources);
  return Object.fromEntries(objects);
}

const lcovParse = promisify(parse);
type LcovMap = { [path: string]: LcovFile };

export async function getLcovData(lcov: string): Promise<LcovMap> {
  let file = await lcovParse(lcov);

  let it = file?.map((item: LcovFile) => {
    return [item.file, item];
  });

  return Object.fromEntries(it ?? []);
}

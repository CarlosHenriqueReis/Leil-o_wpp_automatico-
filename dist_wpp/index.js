"use strict";var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");Object.defineProperty(exports, "__esModule", { value: true });exports.run = run;














var _server = require("@wppconnect/server");
var express = _interopRequireWildcard(require("express"));
var fs = _interopRequireWildcard(require("fs"));
var path = _interopRequireWildcard(require("path"));
var _mergeDeep = _interopRequireDefault(require("merge-deep"));
var _program = require("./program");function _interopRequireWildcard(e, t) {if ("function" == typeof WeakMap) var r = new WeakMap(),n = new WeakMap();return (_interopRequireWildcard = function (e, t) {if (!t && e && e.__esModule) return e;var o,i,f = { __proto__: null, default: e };if (null === e || "object" != typeof e && "function" != typeof e) return f;if (o = t ? n : r) {if (o.has(e)) return o.get(e);o.set(e, f);}for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]);return f;})(e, t);} /*
 * Copyright 2021 WPPConnect Team
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function run() {let serverOptions = {};_program.program.parse();const commandOptions = _program.program.opts();if (commandOptions.config) {try {const json = fs.readFileSync(commandOptions.config, { encoding: 'utf8' });const configOptions = JSON.parse(json);serverOptions = (0, _mergeDeep.default)({}, serverOptions, configOptions);} catch (error) {
      console.log(error);
      process.exit(1);
    }

    delete commandOptions.config;
  }

  const subOptions = ['webhook', 'archive', 'log', 'createOptions'];

  for (const key in commandOptions) {
    const opt = subOptions.find((opt) => key.startsWith(opt));

    if (opt) {
      commandOptions[opt] = commandOptions[opt] || {};

      const name = key.substr(opt.length);
      const newName = name[0].toLowerCase() + name.slice(1);

      commandOptions[opt][newName] = commandOptions[key];
      delete commandOptions[key];
    }
  }

  serverOptions = (0, _mergeDeep.default)({}, serverOptions, commandOptions);

  const { app } = (0, _server.initServer)(serverOptions);

  if (commandOptions.frontend) {
    let frontendPath = commandOptions.frontendPath;

    if (!frontendPath) {
      try {
        const frontendPackage = require.resolve('@wppconnect/frontend/package.json');
        frontendPath = path.join(path.dirname(frontendPackage), 'build');
      } catch (error) {
        console.error(
          'Não foi encontrado o caminho para o frontend, por favor defina com --frontend-path ou instale o pacote @wppconnect/frontend'
        );
        process.exit(1);
      }
    }

    if (frontendPath) {
      // Requisição de configuração do frontend
      app.use('/config.js', (req, res) => {
        res.set({
          'Content-Type': 'application/javascript; charset=UTF-8'
        });
        res.send(`
// Arquivo gerado automaticamente
window.IP_SERVER = location.protocol + "//" + location.host + '/api/';
window.IP_SOCKET_IO = ((location.protocol === 'https:') ? 'wss:' : 'ws:') + "//" + location.host;
`);
      });

      app.use(express.static(frontendPath));

      app.get('*', function (req, res, next) {
        // Força a renderização do react para requisições do browser
        if (req.accepts('html')) {
          return res.sendfile(path.join(frontendPath, 'index.html'));
        }
        next();
      });
    }
  }
}

if (process.env['RUN_SERVER']) {
  run();
}
//# sourceMappingURL=index.js.map
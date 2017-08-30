const tap = require('tap');
const PagedataRenderer = require('../index.js');
const path = require('path');
const async = require('async');
const Hapi = require('hapi');

const templateFile = path.join(__dirname, 'fixture', 'page1.njk');

tap.test('can initiate the class', (t) => {
  const pr = new PagedataRenderer('apiKey', { host: 'http://localhost:8081', userAgent: 'pagedataRenderer/1' });
  t.equal(pr instanceof PagedataRenderer, true);
  t.equal(pr.key, 'apiKey');
  t.equal(pr.options.host, 'http://localhost:8081');
  t.equal(pr.options.userAgent, 'pagedataRenderer/1');
  t.end();
});

tap.test('render', (t) => {
  const pr = new PagedataRenderer('apiKey', { path: __dirname });
  pr.render(templateFile, { content: { text: 'Hello World' } }, (err, result) => {
    t.equal(err, null);
    t.notEqual(result.indexOf('Hello World'), -1);
    t.end();
  });
});

tap.test('renderPage', (t) => {
  const pr = new PagedataRenderer('apiKey', { path: __dirname, host: 'http://localhost:8081' });
  async.autoInject({
    server(done) {
      const server = new Hapi.Server();
      server.connection({
        host: 'localhost',
        port: 8081
      });
      server.route({
        path: '/page/slug',
        method: 'get',
        handler(request, reply) {
          return reply(null, { text: 'Hello World' });
        }
      });
      server.start(() => done(null, server));
    },
    call(server, done) {
      pr.renderPage('/page/slug', templateFile, (err, result) => {
        t.equal(err, null);
        t.notEqual(result.indexOf('Hello World'), -1);
        done();
      });
    },
    stop(server, call, done) {
      server.stop(done);
    }
  }, t.end);
});

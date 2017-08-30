const nunjucks = require('nunjucks');
const async = require('async');
const fs = require('fs');
const wreck = require('wreck');

class PagedataRenderer {
  constructor(key, options) {
    this.key = key;
    this.options = options;
    // options = { host: 'https://app.pagedata.co', userAgent: 'pagedataRenderer/{version}' }
  }

  render(filePath, data, allDone) {
    const options = this.options;
    async.autoInject({
      text(done) {
        fs.readFile(filePath, done);
      },
      env(done) {
        return done(null, new nunjucks.Environment(new nunjucks.FileSystemLoader(options.path)));
      },
      render(text, env, done) {
        const renderer = nunjucks.compile(text.toString(), env);
        return done(null, renderer.render(data));
      }
    }, (err, result) => {
      if (err) {
        return allDone(err);
      }
      return allDone(null, result.render);
    });
  }

  renderPage(pageSlug, templateFile, allDone) {
    const key = this.options.key;
    const host = this.options.host;
    const render = this.render.bind(this);
    async.autoInject({
      pagedata(done) {
        wreck.get(`${host}${pageSlug}?token=${key}`, { json: true }, (err, res, payload) => {
          if (err) {
            return done(err);
          }
          return done(null, payload);
        });
      },
      render(pagedata, done) {
        render(templateFile, { content: pagedata }, done);
      },
    }, (err, result) => {
      if (err) {
        return allDone(err);
      }
      return allDone(null, result.render);
    });
  }
}

module.exports = PagedataRenderer;

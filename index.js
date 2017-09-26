const nunjucks = require('nunjucks');
const async = require('async');
const fs = require('fs');
const PageData = require('pagedata');
const objoin = require('objoin');
const path = require('path');
const mkdirp = require('mkdirp');

class PagedataRenderer {
  constructor(key, options) {
    this.options = options;
    this.userAgent = options.userAgent || `pagedataRenderer/${require('./package.json').version}`;
    this.pagedata = new PageData(options.host, key, this.userAgent);
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

  fetch(pageSlug, allDone) {
    const map = Object.assign({}, this.options.common || {});
    if (pageSlug) {
      map.content = pageSlug;
    }
    async.mapValues(map, (value, key, next) => {
      this.pagedata.getPage(value, (err, pageData) => {
        if (err) {
          return next(err);
        }
        next(null, pageData.content);
      });
    }, allDone);
  }

  renderPage(pageSlug, templateFile, allDone) {
    const render = this.render.bind(this);
    const fetch = this.fetch.bind(this);
    async.autoInject({
      data(done) {
        fetch(pageSlug, done);
      },
      render(data, done) {
        render(templateFile, data, done);
      },
    }, (err, result) => {
      if (err) {
        return allDone(err);
      }
      return allDone(null, result.render);
    });
  }

  renderCollection(collectionSlug, templateFile, allDone) {
    const render = this.render.bind(this);
    const pagedata = this.pagedata;
    const fetch = this.fetch.bind(this);
    async.autoInject({
      commonData(done) {
        fetch(null, done);
      },
      childPages(done) {
        pagedata.getPages({ parentPageSlug: collectionSlug, populate: 'content' }, done);
      },
      renderAll(childPages, commonData, done) {
        objoin(childPages, { key: 'content', set: 'html' }, (content, next) => {
          const data = Object.assign({}, commonData);
          data.content = content;
          render(templateFile, data, next);
        }, done);
      },
    }, (err, result) => {
      if (err) {
        return allDone(err);
      }
      const reduction = {};
      result.childPages.forEach((page) => {
        reduction[page.slug] = page.html;
      });
      return allDone(null, reduction);
    });
  }

  renderAndSave(projectSlug, templatePath, outputPath, allDone) {
    const render = this.render.bind(this);
    const pagedata = this.pagedata;
    async.autoInject({
      childPages(done) {
        pagedata.getPages({ projectSlug, populate: 'content' }, done);
      },
      inputPaths(childPages, done) {
        objoin(childPages, { key: 'slug', set: 'inputPath' }, (slug, next) => {
          const root = slug.replace(`${projectSlug}-`, '');
          const templateFile = path.join(templatePath, `${root}.njk`);
          return next(null, templateFile);
        }, done);
      },
      outputPaths(childPages, done) {
        objoin(childPages, { key: 'slug', set: 'outputPath' }, (slug, next) => {
          const outputFile = (slug === `${projectSlug}-homepage`) ? path.join(outputPath, 'index.html') :
            path.join(outputPath, slug.replace(`${projectSlug}-`, ''), 'index.html');
          return next(null, outputFile);
        }, done);
      },
      mkdirs(outputPaths, childPages, done) {
        async.eachSeries(childPages, (page, eachDone) => {
          if (page.outputPath === path.join(outputPath, 'index.html')) {
            return mkdirp(outputPath, {}, eachDone);
          }
          mkdirp(path.dirname(page.outputPath), {}, eachDone);
        }, done);
      },
      renderAll(inputPaths, outputPaths, mkdirs, childPages, done) {
        async.eachSeries(childPages, (page, eachDone) => {
          if (page.type === 'collection') {
            return;
          }
          render(page.inputPath, { content: page.content }, (err, htmlString) => {
            if (err) {
              return eachDone(err);
            }
            fs.writeFile(page.outputPath, htmlString, eachDone);
          });
        }, done);
      },
    }, allDone);
  }
}

module.exports = PagedataRenderer;

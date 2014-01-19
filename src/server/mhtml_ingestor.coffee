fs = require "fs"
async = require "async"
cheerio = require "cheerio"
htmltidy = require "htmltidy"
cssbeautify = require "cssbeautify"
hat = require "hat"
htmlpretty = require "html"
_ = require "lodash"
cssparse = require "css"
gonzales = require "gonzales"

module.exports = class MHTMLIngestor
  ingest: (sourceDir, primaryContentPath, cb) ->
    self = this
    self.callback = cb

    this.withCssMetadata primaryContentPath, (err, cssMetadata) =>
      this.getFiles sourceDir, (err, files) ->
        return self.callback(err) if err

        processors = {}

        for path in files
          isPrimary = primaryContentPath == path

          processors[path] = ((path, isPrimary) ->
            (cb) -> self.documentsForPath(path, isPrimary, cssMetadata, cb)
          )(path, isPrimary)

        async.parallel processors, (err, results) ->
          self.callback(err, _.compact(_.flatten(_.values(results))))

  withCssMetadata: (primaryContentPath, callback) ->
    fs.readFile primaryContentPath, 'utf8', (err, data) =>
      $ = cheerio.load(data)

      cssMeta = {}

      # Remove CSS
      for link in $("link")
        if ($(link).attr("rel") || "").toLowerCase() == "stylesheet"
          href = $(link).attr("href")
          media = $(link).attr("media")

          if href && media
            cssMeta[href] = { media: media }

      callback(null, cssMeta)

  documentsForPath: (path, isPrimary, cssMetadata, callback) ->
    fs.readFile "#{path}.meta.json", (err, data) =>
      return callback(null) if err

      meta = JSON.parse(data)
      isCss = /\.css$/i.test(path)
      isNotHtml = false

      if meta?
        if meta["content-type"]
          isCss = meta["content-type"].toLowerCase() == "text/css"
          isNotHtml = meta["content-type"].toLowerCase() != "text/html"

        if meta["mhtml-file-offset"]?
          fileIndex = meta["mhtml-file-offset"]

      if isCss
        this.documentsForCssPath(path, fileIndex, cssMetadata, callback)
      else if !isNotHtml && isPrimary
        this.documentsForHtmlPath(path, isPrimary, fileIndex, callback)
      else
        callback(null)

  documentsForCssPath: (path, fileIndex, cssMetadata, callback) ->
    fs.readFile "#{path}.meta.json", (err, data) =>
      return callback(null) if err

      docMeta = JSON.parse(data)
      documentName = _.last(path.split("/"))

      fs.readFile path, 'utf8', (err, data) =>
        css = this.cssContentFromRawCss(data)
        docLocation = docMeta["content-location"].toLowerCase()

        for path, cssMetaCandidate of cssMetadata
          if docLocation.indexOf(path.toLowerCase()) == 0
            cssMeta = cssMetaCandidate

        doc =
          type: "css"
          index: fileIndex
          name: documentName
          content: css

        doc.media = cssMeta.media if cssMeta && cssMeta.media

        callback(null, [doc])
    
  cssContentFromRawCss: (css) ->
    css = _.map(css.split("\n"), (l) ->
      # MHTML export expands "background:0" into this:
      l.replace("background-position: 0px 50%; background-repeat: initial initial", "background:0")
    ).join("\n")

    css = cssbeautify css, { indent: '  ' }
    lines = css.split("\n")
    lines = _.reject(lines, (l) -> l.match(/@import/i))

    lines = _.map lines, (l) ->
      l = l.replace(/(local|url)\(([^'"][^)]+)\)/ig, "$1('$2')")

    css = lines.join("\n")

  documentsForHtmlPath: (path, isPrimary, fileIndex, callback) ->
    documentName = _.last(path.split("/"))

    fs.readFile path, 'utf8', (err, data) =>
      $ = cheerio.load(data)

      # Remove CSS
      $("link[rel='stylesheet']").remove()
      $("link[rel='Stylesheet']").remove()
      $("link[rel='StyleSheet']").remove()
      $("link[rel='STYLESHEET']").remove()

      documents = []
      inlineIndex = 0

      # Generate documents for inline styles
      _.each $("style"), (style) =>
        inlineIndex += 1
        documents.push
          type: "css"
          name: "#{hat(100, 36)}.css"
          content: this.cssContentFromRawCss($(style).html())
          index: (100000 + inlineIndex) # Put the inline styles last

        $(style).remove()
      
      title = $("title").text()

      bodyHtml = $("body").html() || ""
      $("body").empty()
      $("body").addClass($("html").attr("class") || "")

      bodyTag = $("body").toString().replace("</body>", "")

      tidyOps =
        hideComments: true
        indent: true
        wrap: 160
        bare: false
        
      tidyOps["logical-emphasis"] = true
      tidyOps["output-html"] = true
      tidyOps["show-body-only"] = true

      finalize = (err, html) ->
        indentedHtml = _.map(html.match(/[^\r\n]+/g), (s) -> "  #{s}").join("\n")
        finalHtml = "#{bodyTag}\n#{indentedHtml}\n</body>"

        documents.push
          type: "html"
          name: documentName
          index: fileIndex
          primary: isPrimary
          content: finalHtml

        callback(null, documents)

      # Screws up CNN.com's doubly nested ul's :P
      htmltidy.tidy(bodyHtml, tidyOps, finalize)

  getFiles: (dir, cb) ->
    pending = [dir]
    allFiles = []

    async.whilst (-> pending.length > 0), ((callback) ->
      next = pending.pop()

      fs.readdir next, (err, files) ->
        return cb(err) if err

        files ?= []

        for file in files
          path = "#{next}/#{file}"
          stat = fs.statSync(path)

          if stat.isFile()
            allFiles.push(path)
          else if stat.isDirectory()
            pending.push(path)

        callback()
    ), ((err) -> cb(err, allFiles))


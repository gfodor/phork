express = require "express"
hat = require "hat"
AWS = require "aws-sdk"
AWS.config.loadFromPath('config/aws.json')
mhtml = require "mhtml"
temp = require "temp"
fs = require "fs"
cors = require "cors"
url = require "url"
util = require "util"
livedb = require "livedb"
zlib = require 'zlib'
sharejs = require "share"
_ = require "lodash"
{Duplex} = require 'stream'
browserChannel = require('browserchannel').server

MHTMLIngestor = require '../../lib/mhtml_ingestor'
PhorkWriter = require '../../lib/phork_writer'
inflate = require "../../lib/rawinflate"

module.exports = app = express()

temp.track()

app.use express.urlencoded()
app.use express.json()
app.use express.compress()
app.use cors()

app.use "/", express.static("assets")

app.set 'view engine', 'jade'

dynamodb = new AWS.DynamoDB()
s3 = new AWS.S3()
backend = livedb.client require("livedb-dynamodb")(dynamodb, s3, { bucketName: "phork-data" })
redis = require("redis").createClient(6379, "localhost")
share = sharejs.server.createClient {backend, redis}

app.use browserChannel {webserver: app}, (client) ->
  stream = new Duplex objectMode:yes
  stream._write = (chunk, encoding, callback) ->
    #console.log 's->c ', chunk
    if client.state isnt 'closed' # silently drop messages after the session is closed
      client.send chunk
    callback()

  stream._read = -> # Ignore. You can't control the information, man!

  stream.headers = client.headers
  stream.remoteAddress = stream.address

  client.on 'message', (data) ->
    #console.log 'c->s ', data
    stream.push data

  stream.on 'error', (msg) ->
    client.stop()

  client.on 'close', (reason) ->
    stream.emit 'close'
    stream.emit 'end'
    stream.end()

  # ... and give the stream to ShareJS.
  share.listen stream

handle_error = (err) ->
  return unless err
  util.log err
  util.log err.stack

app.use '/doc', share.rest()

app.get "/phorks/new", (req, res) ->
  phork_id = hat 100, 36
  s3 = new AWS.S3()

  s3.getSignedUrl "putObject",
    Bucket: "phork-data",
    ContentType: "multipart/related",
    Key: "uploads/mhtml/#{phork_id}.mhtml", (err, mHtmlUrl) ->
      res.send { mhtml_url: mHtmlUrl, phork_id: phork_id }

app.get "/guard", (req, res) ->
  res.render 'guard'

app.get "/styframe", (req, res) ->
  res.render 'styframe'

withPhorkDocs = (phork_id, callback) ->
  dynamodb.query
    TableName: "phork_docs"
    Select: "ALL_ATTRIBUTES"
    ConsistentRead: true
    KeyConditions:
      phork_id:
        AttributeValueList: [{ S: phork_id }]
        ComparisonOperator: "EQ"
    (err, data) ->
      callback([]) if err

      docs = _.map data.Items, (item) ->
        doc =
          created_at: new Date(_.parseInt(item.created_at.N))
          doc_id: item.doc_id.S
          type: item.type.S
          index: parseInt(item.index.N)
          primary: item.primary.N == '1'
          name: item.name.S

        doc.media = item.media.S if item.media
        doc.doctype = item.doctype.S if item.doctype
        doc

      docs = _.sortBy(docs, (d) -> if d.primary then -1 else d.index)
      callback(docs)

app.get "/phorks/:phork_id.json", (req, res) ->
  withPhorkDocs req.params.phork_id, (docs) ->
    res.json { docs }

app.get "/phorks/:phork_id", (req, res) ->
  doctype = ""

  withPhorkDocs req.params.phork_id, (docs) ->
    primaryDoc = _.find(docs, (d) -> d.primary)

    if primaryDoc && primaryDoc.doctype
      doctype = primaryDoc.doctype

    res.render 'phork', { phork_id: req.params.phork_id, dt: "#{doctype}\n\n" }

app.post "/phorks", (req, res) ->
  s3 = new AWS.S3()
  phork_id = req.body.phork_id
  user_id = hat 100, 36

  return res.send(400, "Required argment phork_id missing.") unless phork_id
  ingestor = new MHTMLIngestor()
  writer = new PhorkWriter()

  temp.mkdir "phork", (err, tempPath) ->
    s3.getObject
      Bucket: "phork-data",
      Key: "uploads/mhtml/#{phork_id}.mhtml", (err, mhtmlCompressedData) ->
        return res.send(500, err) if handle_error(err)

        mhtmlData = inflate.inflate mhtmlCompressedData.Body.toString("utf8")

        temp.open "#{phork_id}.temp.mhtml", (err, mhtmlTempInfo) ->
          return res.send(500, err) if handle_error(err)

          fs.write mhtmlTempInfo.fd, new Buffer(mhtmlData), 0, mhtmlData.length, null, (err, mhtmlWritten, mhtmlBuffer) ->
            return res.send(500, err) if handle_error(err)

            fs.close(mhtmlTempInfo.fd)

            mhtml.extract mhtmlTempInfo.path, tempPath, false, true, true, (err, primaryContentPath, primaryContentUrl) ->
              return res.send(500, err) if handle_error(err)

              primaryContentDomain = ""

              if primaryContentUrl?
                primaryUrl = url.parse(primaryContentUrl)

                if primaryUrl.host?
                  primaryContentDomain = primaryUrl.host

              ingestor.ingest tempPath, primaryContentPath, (err, docs) ->
                return res.send(500, err) if handle_error(err)

                writer.writePhork phork_id, user_id, primaryContentDomain, docs, backend, (err) ->
                  return res.send(500, err) if handle_error(err)

                  res.send({ phork_id: phork_id })


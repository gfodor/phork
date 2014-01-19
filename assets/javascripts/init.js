// Generated by CoffeeScript 1.5.0
(function() {

  $(function() {
    var afterHelperFramesReady, components, docReflowTimeouts, docUpdateTimeouts, guardCount, guardFrame, htmlVersion, initCssDoc, initDoc, initPrimaryDoc, phorkId, primaryAceEditor, primaryComponent, readyDocs, readyStyFrames, reflow, resetGuard, styFrames, totalDocs, updateDOMAfterGuard;
    phorkId = $('body').data('phorkId');
    readyDocs = {};
    totalDocs = 0;
    htmlVersion = 0;
    guardCount = 0;
    guardFrame = null;
    styFrames = {};
    readyStyFrames = {};
    primaryComponent = null;
    components = {};
    primaryAceEditor = null;
    docUpdateTimeouts = {};
    docReflowTimeouts = {};
    reflow = function() {
      var content, s;
      content = primaryComponent.props.content;
      s = $(window).scrollTop();
      primaryComponent.setProps({
        content: "<div></div>"
      });
      primaryComponent.setProps({
        content: content
      });
      return $(window).scrollTop(s);
    };
    resetGuard = function() {
      var $guardFrame;
      if (guardFrame && (guardFrame.isReady == null)) {
        return;
      }
      $(".phork-guard").unbind("ready").remove();
      $guardFrame = $("<iframe>");
      $guardFrame.attr({
        src: "/guard",
        "class": "phork-guard",
        id: "phork-guard-" + (guardCount++)
      });
      guardFrame = $guardFrame[0];
      return $("body").append($guardFrame);
    };
    resetGuard();
    updateDOMAfterGuard = function() {
      var msg;
      if (guardFrame && (guardFrame.isReady != null)) {
        msg = {
          beforeHtml: primaryComponent.props.content,
          afterHtml: primaryAceEditor.getValue(),
          version: ++htmlVersion
        };
        return guardFrame.contentWindow.postMessage(JSON.stringify(msg), "*");
      }
    };
    window.addEventListener("message", function(e) {
      var data;
      data = JSON.parse(e.data);
      if (data.type === "guard") {
        if (data.result) {
          if (data.version === htmlVersion) {
            return primaryComponent.setProps({
              content: data.afterHtml
            });
          }
        } else {
          return resetGuard();
        }
      } else if (data.type === "guardReady") {
        if (guardFrame && e.source === guardFrame.contentWindow) {
          return guardFrame.isReady = true;
        }
      }
    });
    afterHelperFramesReady = function(docInfo, cb) {
      var styframe, waitForStyFrame;
      if (docInfo.type === "css") {
        styframe = $("<iframe>");
        styframe.attr({
          src: "/styframe",
          "class": "phork-styframe",
          id: "phork-styframe-" + docInfo.doc_id
        });
        styframe.ready(function() {
          return readyStyFrames[docInfo.doc_id] = true;
        });
        styFrames[docInfo.doc_id] = styframe[0];
        $("body").append(styframe);
        waitForStyFrame = function() {
          if (readyStyFrames[docInfo.doc_id]) {
            return cb();
          } else {
            return setTimeout(waitForStyFrame, 100);
          }
        };
        return waitForStyFrame();
      } else {
        return cb();
      }
    };
    initDoc = function(docInfo, sjs) {
      totalDocs += 1;
      return afterHelperFramesReady(docInfo, function() {
        var doc;
        doc = sjs.get('docs', docInfo.doc_id);
        doc.subscribe();
        return doc.whenReady(function() {
          var aceEditor, codeDiv, editor;
          codeDiv = $("<div>").prop("id", "code-" + docInfo.doc_id);
          editor = $("<div>");
          codeDiv.append(editor);
          $("#phork-ui .tabs").append(codeDiv);
          aceEditor = ace.edit("code-" + docInfo.doc_id);
          $("#code-" + docInfo.doc_id).addClass("code-editor");
          aceEditor.getSession().setMode("ace/mode/" + docInfo.type);
          aceEditor.setTheme("ace/theme/monokai");
          doc.attach_ace(aceEditor);
          if (docInfo.primary) {
            initPrimaryDoc(docInfo, doc, aceEditor);
          } else if (docInfo.type === "css") {
            initCssDoc(docInfo, doc, aceEditor);
          }
          return true;
        });
      });
    };
    initPrimaryDoc = function(docInfo, doc, aceEditor) {
      var showWhenAllDocsReady;
      primaryComponent = new HtmlRenderer({
        content: doc.snapshot
      });
      components[docInfo.doc_id] = primaryComponent;
      primaryAceEditor = aceEditor;
      aceEditor.getSession().on("change", function(e) {
        var reflowTimeout, updateTimeout;
        updateTimeout = docUpdateTimeouts[docInfo.doc_id];
        if (updateTimeout) {
          clearTimeout(updateTimeout);
        }
        docUpdateTimeouts[docInfo.doc_id] = setTimeout(updateDOMAfterGuard, 250);
        reflowTimeout = docReflowTimeouts[docInfo.doc_id];
        if (reflowTimeout) {
          clearTimeout(reflowTimeout);
        }
        docReflowTimeouts[docInfo.doc_id] = setTimeout(reflow, 2500);
        return true;
      });
      readyDocs[docInfo.doc_id] = true;
      showWhenAllDocsReady = function() {
        if (_.keys(readyDocs).length >= totalDocs) {
          return setTimeout((function() {
            return React.renderComponent(primaryComponent, $("#doc-container .phork-html")[0]);
          }), 0);
        } else {
          return setTimeout(showWhenAllDocsReady, 100);
        }
      };
      return showWhenAllDocsReady();
    };
    initCssDoc = function(docInfo, doc, aceEditor) {
      var component, styleContainer, updateCssViaStyframe;
      styleContainer = $("<div>").attr("id", "styles-" + docInfo.doc_id)[0];
      $(".phork-styles").append(styleContainer);
      component = new CssRenderer(styleContainer);
      components[docInfo.doc_id] = component;
      updateCssViaStyframe = function(css, doc_id) {
        var styleSheet;
        $("style", $(styFrames[doc_id].contentWindow.document)).html(css);
        styleSheet = styFrames[doc_id].contentWindow.document.styleSheets[0];
        component = components[doc_id];
        return component.update(doc_id, styleSheet);
      };
      (function(component, docInfo, doc) {
        return setTimeout((function() {
          updateCssViaStyframe(doc.snapshot, docInfo.doc_id);
          return readyDocs[docInfo.doc_id] = true;
        }), 0);
      })(component, docInfo, doc);
      return aceEditor.getSession().on("change", function(e) {
        var updateTimeout;
        updateTimeout = docUpdateTimeouts[docInfo.doc_id];
        if (updateTimeout) {
          clearTimeout(updateTimeout);
        }
        docUpdateTimeouts[docInfo.doc_id] = setTimeout((function(component, docInfo, doc) {
          return function() {
            return updateCssViaStyframe(aceEditor.getValue(), docInfo.doc_id);
          };
        })(component, docInfo, doc), 250);
        return true;
      });
    };
    return $.get("/phorks/" + phorkId + ".json", {
      dataType: "json"
    }, function(res) {
      var docInfo, sjs, socket, _i, _len, _ref, _results;
      socket = new BCSocket(null, {
        reconnect: true
      });
      sjs = new window.sharejs.Connection(socket);
      _ref = res.docs;
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        docInfo = _ref[_i];
        _results.push(initDoc(docInfo, sjs));
      }
      return _results;
    });
  });

}).call(this);

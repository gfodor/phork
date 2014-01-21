// Generated by CoffeeScript 1.5.0
(function() {
  var HtmlToRNodeParser;

  HtmlToRNodeParser = (function() {
    var ATTRIBUTE_MAPPING, NODE_TYPE;

    function HtmlToRNodeParser() {}

    NODE_TYPE = {
      ELEMENT: 1,
      TEXT: 3,
      COMMENT: 8
    };

    ATTRIBUTE_MAPPING = {
      "for": "htmlFor",
      "class": "className",
      frameborder: "frameBorder",
      cellpadding: "cellPadding",
      cellspacing: "cellSpacing",
      colspan: "colSpan",
      tabindex: "tabIndex",
      autocomplete: "autoComplete",
      maxlength: "maxLength",
      autocorrect: "autoCorrect",
      autocapitalize: "autoCapitalize"
    };

    HtmlToRNodeParser.prototype.htmlToRNode = function(html, previousBracketDiff, previousTagDiff) {
      var container;
      container = document.createElement('html');
      html = html.replace(/<\s*html/gi, "<phork-html");
      html = html.replace(/<\/html/gi, "</phork-html");
      html = html.replace(/<\s*body/gi, "<phork-body");
      html = html.replace(/<\/body/gi, "</phork-body");
      html = html.replace(/&nbsp;/gi, "<span class=\"phork-nbsp\">&nbsp;</span>");
      container.innerHTML = html;
      return this.rNodeFromNode($(container)[0], "rNodeRoot");
    };

    HtmlToRNodeParser.prototype.cleanHtml = function(html) {
      return html.trim().replace(/<script(.|\s)*<\/script>/gim, '').replace(/<noscript(.|\s)*<\/noscript>/gim, '');
    };

    HtmlToRNodeParser.prototype.rNodeFromNode = function(node, rNodeKey) {
      switch (node.nodeType) {
        case NODE_TYPE.ELEMENT:
          return this.elementRNodeFromNode(node, rNodeKey);
        case NODE_TYPE.TEXT:
          if (node.textContent.trim().length > 0) {
            return React.DOM.text({}, node.textContent.trim());
          } else {
            return null;
          }
      }
    };

    HtmlToRNodeParser.prototype.elementRNodeFromNode = function(node, rNodeKey, isRoot) {
      var attribute, attributeName, childNode, childRNode, childrenRNodes, isBody, isFont, isHtml, isTT, konstructor, rNodeAttributes, selector, sizes, styles, tag, value, _i, _j, _k, _len, _len1, _len2, _ref, _ref1, _ref2, _ref3;
      tag = node.tagName.toLowerCase();
      if (tag === "script" || tag === "noscript" || tag === "head") {
        return null;
      }
      isTT = tag === "tt";
      isBody = tag === "phork-body";
      isHtml = tag === "phork-html";
      isFont = tag === "font";
      rNodeAttributes = {
        key: rNodeKey
      };
      konstructor = (!isBody && !isHtml && React.DOM[tag]) || React.DOM.div;
      styles = {};
      if (isTT) {
        styles["font-family"] = "monospace";
      }
      if (!isFont) {
        _ref = node.attributes;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          attribute = _ref[_i];
          attributeName = ATTRIBUTE_MAPPING[attribute.name] || attribute.name;
          if (attributeName === "style") {
            _ref1 = this.parseStyles(attribute.value);
            for (selector in _ref1) {
              value = _ref1[selector];
              styles[selector] = value;
            }
          } else {
            rNodeAttributes[attributeName] = attribute.value;
          }
        }
        if (_.keys(styles).length > 0) {
          rNodeAttributes.style = styles;
        }
      } else {
        _ref2 = node.attributes;
        for (_j = 0, _len1 = _ref2.length; _j < _len1; _j++) {
          attribute = _ref2[_j];
          if (attribute.name === "face") {
            styles["font-family"] = attribute.value;
          } else if (attribute.name === "color") {
            styles["color"] = attribute.value;
          } else if (attribute.name === "size") {
            sizes = {
              "-3": "x-small",
              "-2": "x-small",
              "-1": "small",
              "0": "x-small",
              "1": "x-small",
              "2": "small",
              "3": "medium",
              "4": "large",
              "5": "x-large",
              "6": "xx-large",
              "+0": "medium",
              "+1": "large",
              "+2": "x-large",
              "+3": "xx-large",
              "+4": "-webkit-xxx-large",
              "+5": "-webkit-xxx-large",
              "+6": "-webkit-xxx-large",
              "+7": "-webkit-xxx-large"
            };
            if (sizes[attribute.value]) {
              styles["font-size"] = sizes[attribute.value];
            } else {
              styles["font-size"] = attribute.value;
            }
          }
        }
        rNodeAttributes.style = styles;
      }
      if (isHtml) {
        if (rNodeAttributes.className == null) {
          rNodeAttributes.className = "";
        }
        rNodeAttributes.className += " phork-html";
      } else if (isBody) {
        if (rNodeAttributes.className == null) {
          rNodeAttributes.className = "";
        }
        rNodeAttributes.className += " phork-body";
      }
      childrenRNodes = [];
      _ref3 = node.childNodes;
      for (_k = 0, _len2 = _ref3.length; _k < _len2; _k++) {
        childNode = _ref3[_k];
        childRNode = this.rNodeFromNode(childNode, "rNode" + childrenRNodes.length);
        if (childRNode) {
          childrenRNodes[childrenRNodes.length] = childRNode;
        }
      }
      return new konstructor(rNodeAttributes, childrenRNodes);
    };

    HtmlToRNodeParser.prototype.parseStyles = function(rawStyle) {
      var firstColon, key, style, styles, value, _i, _len, _ref;
      styles = {};
      _ref = rawStyle.split(";");
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        style = _ref[_i];
        style = style.trim();
        firstColon = style.indexOf(':');
        key = style.substr(0, firstColon);
        value = style.substr(firstColon + 1).trim();
        if (key !== '') {
          styles[key] = value;
        }
      }
      return styles;
    };

    return HtmlToRNodeParser;

  })();

  window.HtmlToRNodeParser = HtmlToRNodeParser;

}).call(this);

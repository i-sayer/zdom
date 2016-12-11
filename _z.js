/*
    modern utility code for non AEM forms etc
    Ian Sayer - November 2015

          _z.dom() - bare minimum zencoding => dom element creation. Used by contact badge code
    _z.insertUpi() - Uses JSONP to lookup details from directory and insert a wee badge
    _z.buildForm() - create markup for a form based on table of panels>fields
*/
var _z = (function ()
{
/**
    @description use css style selector string to generate DOM elements.
    @parameter {string} selector - list of element.class#id[+sibling|>child]
    @parameter [array|object] - Array or Object used for textContent|attribute substitution for ; character: "div;0", ["My text"] | "a;0", [{href:"mylink.com"}]
    @returns {dom element|documentFragment} 
*/
    var dom = function(str, formatitems)
    {
        var retval = document.createDocumentFragment();
        var fr = str.match(/(^[^>+]+|[>+]+[^>+]+)/g); // list of (node) (+sibbling) (>child)
        var curlev = retval;
        for (var i = 0, f; f = fr[i]; i++)
        {
            var ename, p, sub = f.match(/(\W*[\w| |\-|\\|=)]+)/g);
            ename = sub[0];
            while (ename.charAt(0) == '+')
            {
                ename = ename.substr(1);
                curlev = curlev.parentElement;
            }
            curlev = curlev || retval; // documentFragment if at top
            if (ename.charAt(0) == '>')
            {
                ename = ename.substr(1);
            }
            p = document.createElement(ename);
            var classes = [];
            for (var j = 1, s = sub[0].substr(1); (j < sub.length) && (s = sub[j]) ; j++)
            {
                switch (s.charAt(0))
                {
                    case '.':
                        classes.push(s.substr(1));
                        break;
                    case '#':
                        p.id = s.substr(1);
                        break;
                    case ':':
                        var tmp = s.split("=");
                        if (tmp.length > 1)
                            p.setAttribute(tmp[0].substr(1), tmp[1]);
                        else
                            p.textContent = s.substr(1);
                        break;
                    case ';':
                        var o = formatitems[s.substr(1)];
                        if (typeof o == "object")
                        {
                            for (var k in o)
                            {
                                p.setAttribute(k, o[k]);
                            }
                        }
                        else
                        {
                            p.innerHTML = o;
                        }
                        break;
                }
            }
            if (classes.length)
            {
                p.className = classes.join(" ");
            }
            curlev = curlev.appendChild(p);
            if (s.charAt(0) == '*')
            {
                s = s.substr(1);
                while (s.length)
                {
                    while (s[0] == "p")
                    {
                        s = s.substr(1);
                        p = curlev = curlev.parentElement;
                    }
                    var qty = parseInt(s);
                    for (j = 1; j < qty; j++)
                    {
                        p = curlev.parentElement.appendChild(p.cloneNode(true));
                    }
                    s = s.substr(Math.floor(Math.log10(qty) + 1));
                }
            }
        }
        return retval.childNodes.length==1?retval.firstChild:retval;
    }
/**
    @description wrapper for dom() that returns string version for testing
    @returns {string} 
*/
    var dom2str = function (str, formatitems)
    {
        return (dom(str, formatitems)).outerHTML;
    }

/**
    @description build object with name:values => selector:rules
    @parameter {number} sheet - index of stylesheet
    @returns {object} 
*/
    var css2json = function (sheet)
    {
        var a = Array.prototype.slice.call(document.styleSheets[sheet].cssRules);
        var kk = {};
        a.forEach(function (x)
        {
            var im = {};
            var s = x.style.cssText.split(";");
            s.forEach(function (y)  {
                j = y.split(":");
                if (j.length>1)
                {
                    im[j[0].trim()] = j[1].trim();
                }
            });
            kk[x.selectorText] = im;
        });
        return kk; // use JSON.stringify(kk) for text
    }

/**
    @description take object with name:values => selector:rules and insert a stylesheet
    @parameter {object} bb - the object that defines selectors:rules
*/
    var json2css = function (bb)
    {
        // create stylesheet based on json object, use browser prefix if required
        var style = document.createElement("style");
        var proto = style.style;
        document.head.appendChild(style);
        var sheet = style.sheet;
        for (selector in bb)
        {
            var rules = [];
            var vals = bb[selector];
            for (att in vals)
            {
                if (att[0] == "-")
                    continue;
                // check for prefix required, eventualy
                var fatt = att;
                var catt = camel(att);
                if (!(catt in proto)) // not w3c
                {
                    var pref = [{ j: "Moz", c: "-moz-" }, { j: "webkit", c: "-webkit-" }, { j: "ms", c: "-ms-" }];
                    catt = catt[0].toUpperCase() + catt.substr(1);
                    for (var i = 0, j; j = pref[i]; i++)
                    {
                        if ((j.j + catt in proto))
                        {
                            fatt = j.c + att;
                            break;
                        }
                    }
                }
				if (att=="cursor")
				{
					style.style.cursor = vals[att];
					if (style.style.cursor == "")
						vals[att] = "-webkit-"+vals[att];
				}
                rules.push(fatt + ":" + vals[att]);
            }
            var rulestr = selector+"{ "+rules.join("; ")+" }";
            sheet.insertRule(rulestr, 0);
        }
    };

/**
    @description convert from css attribute syntax, to js camel case
    @parameter {string} str - css syntax attribute name
    @returns {string} - javascript attribute name ie: "text-align"=>"textAlign" 
*/
    function camel(str)
    {
        var tmp = str.split('-');
        var cameled = tmp[0];
        tmp.slice(1).forEach(function (wrd)
        {
            cameled += wrd.charAt(0).toUpperCase() + wrd.substr(1);
        });
        return cameled;
    }

    /* code for contact badges
    */
    function getPhoneNumberFromExtension(extension)
    {
        if (extension)
        {
            if (extension[0] === '8')// DDI
                return '+64 (0) 9 923 ' + extension.substring(1);
            else if (extension[0] === '0') // mobile number probably, appears on occasion
                return '+64 ' + extension;
            else
                return '+64 (0) 9 373 7599 ext ' + extension;
        }
        else
            return '+64 (0) 9 373 7599';
    }

    var glob_list = {};
    var headElement = document.head || document.getElementsByTagName("head")[0];
    var url = "https://unidirectory.auckland.ac.nz/people/";
    //var url = "https://unidirectory.auckland.ac.nz/people/nquickprofile/";

    var upiBuffered = function (upi)
    {
        return !!(upi in this.glob_list);
    }

/**
    @description generate and optionaly insert a contact badge using JSON from UoA directory
    @parameter {string} upi - also accepts UoA email
    @parameter {string|element} container - id of containing element | the containing element
    @parameter [input] inputel - html input element to bind
    @parameter [number] index - index of html input element in current form
    @parameter [boolean] showid - option to enable user id code in badge
    @parameter [function] unpackcb - replace default unpackBadge callback for alternate use of lookup data
*/
    var insertUpi = function (upi, container, inputel, index, showid, unpackcb)
    {
        if (upi in this.glob_list == false)
        {
			if (container)
			{
				var place = (typeof container == 'string') ? document.getElementById(container) : container;
				place.appendChild(dom("div.loading.super#" + upi));
			}
			this.glob_list[upi] = {
                target_upi: upi,
                container_id: container,
                active: true,
                init: initialiseBadge,
                data: {},
                showid: showid,
                unpack: unpackcb || unpackBadge
            };
            if (inputel)
            {
                this.glob_list[upi].inputel = inputel;
                this.glob_list[upi].index = index;
            }
            var scr = document.createElement('script');
            scr.src = url + "quickprofile/" +
                upi + "?callback=_z.glob_list['" +
                upi + "'].init&json=true";
            headElement.appendChild(scr);
        }
    };

    function initialiseBadge(data)
    {
        this.data = data;
        this.unpack();
    };

    function unpackBadge()
    {
        var imageUrl, profileUrl;
        var tu = document.getElementById(this.target_upi);
        tu.className = "super";
        var ta = tu.parentElement.nextElementSibling;
        if (!this.data)
        {
            var tmp = ZenDom.parse(this.target_upi, "div>div.placeholder+h3{Not Found:" + this.target_upi);
            return;
        }
        if (this.data.imageId)
            imageUrl = url + "imageraw/" + this.data.profileUrl + "/" + this.data.imageId + "/small";
        else
            imageUrl = "https://unidirectory.auckland.ac.nz/static/Cx7H5OOpJixzRa4KCDf8GgO00W2MynocaUYpL5oss8R.png";
        profileUrl = url + this.data.profileUrl;
        var phone = getPhoneNumberFromExtension(this.data.contact.extn);
        var id = this.data.id;
        var shorterName = [this.data.title, this.data.firstName, this.data.lastName.replace("'", "\u2019")].join(" ");
        if (ta)
            ta.value = shorterName + ", Phone: " + phone + ", ID: " + id;
        if (this.showid)
            phone += " \xA0 ID: " + id;
        var title = this.data.positions[0].name;// + ", " + this.data.positions[0].orgName;
        var email = this.data.contact.email;
        var tmp = dom("div.contact-badge>div.thumb>img;0++div.contact-information>a;1>strong;2++p>span;3+br+a;4;6+br+span;5",
            [{ src: imageUrl }, { href: profileUrl, target: "_blank" }, shorterName, title, { href: "mailto:" + email }, phone, email]);
        tu.appendChild(tmp);
    };

    // polyfill for IE Math.log10
    if (!Math.log10)
        Math.log10 = function (x) { return Math.log(x) / Math.LN10 };

    // form stuff, needs augmentation for conditional visibilty, date picker etc
    // see mhsfaculty/forms/new/PSGATravelGrant.html for panel structure and useage
    var buildForm = function(panels, dform)
    {
        var tabix = 1;
        if (!Array.prototype.forEach)
        {
            dform.appendChild(dom("center;0", ["This browser is not supported, please upgrade or try Firefox or Chrome"]));
            return;
        }
        panels.forEach(function (panel, pix)
        {
            var pdiv = dom("div.panel>h3;0", [panel.p]);
            panel.f.forEach(function (field, fix)
            {
                var e1, e2, e3, e4;
                var inp = null;
                var required = (field.r) ? "<span class=\"red\">*</s>" : "";
                switch (field.t)
                {
                    case "p":
                        e1 = dom("p;0", [field.p]);
                        break;
                    case "tl":
                    case "ts":
                        e1 = dom("label;0>div.textboxwrap>input;1", [field.p + required, { name: field.n || field.p, "class": (field.t == "tl") ? "long" : "" }]);
                        inp = e1.querySelector("input");
                        if (field.readonly)
                        {
                            inp.setAttribute("readonly", "");
                        }
                        if (field.r)
                        {
                            inp.setAttribute("required", "true");
                        }
                        if (field.h)
                        {
                            inp.placeholder = field.h;
                        }
                        break;
                    case "rb":
                        e1 = dom("p>span.qu");
                        e1.className = (fix & 1) ? "odd" : "even";
                        var name = field.n || field.p;
                        e1.firstChild.innerHTML = name + required;
                        var options = panel.o || field.o.reverse(); // default radio button list for panel if no field specific list of options
                        options.forEach(function (option, index)
                        {
                            e2 = dom("label;0>input;1", [option, { type: "radio", name: "r" + pix + fix, value: (field.o)?(name + "-" + option):(options.length-index) }]);
                            inp = e2.firstElementChild;
                            if (field.r)
                            {
                                inp.setAttribute("required", "true");
                            }
                            e1.appendChild(e2);
                        });
                        inp.checked = field.r?false:true;
                        break;
                    case "ta":
                        inp = dom("textarea;0", [{ name: field.n || field.p }]);
                        e1 = inp;
                        break;
                    case "fu":
                        e1 = dom("input;0", [{ type: "file", name: "files", multiple: "multiple" }]);
                        break;
                    default:
                        e1 = null;
                }
                if (inp)
                {
                    if (field.oc)
                    {
                        inp.oninput = field.oc;
                        inp.onblur = field.oc;
                        inp.setAttribute("data-oc", field.oc.name);
                    }
                    if (field.y)
                        inp.type = field.y;
                    inp.tabIndex = tabix++;
                }
                if (e1)
                {
                    pdiv.appendChild(e1);
                }
            });
            dform.appendChild(pdiv);
        });
        //e1 = document.createElement("input");
        //e1.type = "submit";
        //e1.value = "Submit Application";
        dform.appendChild(dom("input#submitbutton;sub+div#response", { sub: {type:"submit", value:"Submit Form"}}));
        if (olderIE)
        {
            document.getElementById("submitbutton").onclick = function (e) // do client side validation
            {
                var req = document.querySelectorAll("input[required]");
                var allgood = req.length;
                Array.prototype.slice.call(req).forEach(function (f)
                {
                    if (f.value == "")
                    {
                        f.style.borderColor = "red";
                    }
                    else
                    {
                        f.style.borderColor = "black";
                        --allgood;
                    }
                });
                if (allgood != 0)
                {
                    alert("Please complete all required fields.");
                    event.returnValue = false;
                } else
                {
                    event.returnValue = true;
                    document.getElementById("form1").submit();
                }
            }
        }
    }

    return {
        insertUpi: insertUpi,
        upiBuffered: upiBuffered,
        buildForm: buildForm,
        dom: dom,
        dom2str: dom2str,
        css2json: css2json,
        json2css: json2css,
		url: url,
		getPhoneNumberFromExtension: getPhoneNumberFromExtension,
        glob_list: glob_list
    };
})();
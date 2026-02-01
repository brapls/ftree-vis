$(document).ready(docMain);

var conf = {};
conf['depth'] = 3;
conf['width'] = 8;   // NOTE: width/2 = k (unchanged)

var controlVisible = true;
var selectedHosts = [];
/* =========================
   Logical Fat-Tree Model
   (non-invasive, used for stats & discussion)
========================= */

function fatTreeModel(depth, width) {
    var k = Math.floor(width / 2);
    return {
        depth: depth,
        k: k,
        servers: Math.pow(k, 3) / 4,
        torSwitches: Math.pow(k, 2) / 2,
        aggSwitches: Math.pow(k, 2) / 2,
        coreSwitches: Math.pow(k, 2) / 4
    };
}

/* =========================
   Init
========================= */

function docMain() {
    formInit();
    redraw();
    $(document).keypress(kpress);
}

function kpress(e) {
    if (e.which === 104) { // 'h'
        controlVisible = !controlVisible;
        $("div.control").toggle(controlVisible);
    }
}

function redraw() {
    drawFatTree(conf['depth'], conf['width']);
}

/* =========================
   Drawing Logic (UNCHANGED)
========================= */

function drawFatTree(depth, width) {

    var k = Math.floor(width / 2);
    var model = fatTreeModel(depth, width);

    var padg = 13;
    var padi = 12;
    var hline = 70;
    var hhost = 50;

    var podw = 8;
    var podh = 8;
    var hostr = 2;

    var kexp = function (n) { return Math.pow(k, n); };

    d3.select("svg.main").remove();

    /* === Safe scalability guard === */
    if (kexp(depth - 1) > 1500 || depth <= 0 || k <= 0) {
        alert("Topology too large to render interactively.");
        return;
    }

    var w = kexp(depth - 1) * padg + 200;
    var h = (2 * depth) * hline;

    var svg = d3.select("body").append("svg")
        .attr("width", w)
        .attr("height", h)
        .attr("class", "main")
        .append("g")
        .attr("transform", "translate(" + w / 2 + "," + h / 2 + ")");

    var linePositions = [];

    function podPositions(d) {
        var ret = [];

        var ngroup = kexp(d);
        var pergroup = kexp(depth - 1 - d);

        var wgroup = pergroup * padg;
        var wgroups = wgroup * (ngroup - 1);
        var offset = -wgroups / 2;

        for (var i = 0; i < ngroup; i++) {
            var wpods = pergroup * padi;
            var goffset = wgroup * i - wpods / 2;

            for (var j = 0; j < pergroup; j++) {
                ret.push(offset + goffset + padi * j);
            }
        }
        return ret;
    }

    for (var i = 0; i < depth; i++) {
        linePositions[i] = podPositions(i);
    }

    /* =========================
       Data-driven Pods (SAFE)
    ========================= */

    function drawPods(list, y) {
        svg.selectAll("rect.pod.y" + y)
            .data(list)
            .enter()
            .append("rect")
            .attr("class", "pod")
            .attr("width", podw)
            .attr("height", podh)
            .attr("x", function (d) { return d - podw / 2; })
            .attr("y", y - podh / 2);
    }

    function drawHost(x, y, dy, dx) {
        svg.append("line")
            .attr("class", "cable")
            .attr("x1", x)
            .attr("y1", y)
            .attr("x2", x + dx)
            .attr("y2", y + dy);

        svg.append("circle")
            .attr("class", "host")
            .attr("cx", x + dx)
            .attr("cy", y + dy)
            .attr("r", hostr);
    }

    function drawHosts(list, y, direction) {
        for (var i = 0; i < list.length; i++) {
            drawHost(list[i], y, hhost * direction, -4);
            drawHost(list[i], y, hhost * direction, 0);
            drawHost(list[i], y, hhost * direction, 4);
        }
    }

    function linePods(d, list1, list2, y1, y2) {
        var pergroup = kexp(depth - 1 - d);
        var ngroup = kexp(d);
        var perbundle = pergroup / k;

        for (var i = 0; i < ngroup; i++) {
            var offset = pergroup * i;
            for (var j = 0; j < k; j++) {
                var boffset = perbundle * j;
                for (var t = 0; t < perbundle; t++) {
                    var ichild = offset + boffset + t;
                    for (var u = 0; u < k; u++) {
                        var ifather = offset + perbundle * u + t;
                        svg.append("line")
                            .attr("class", "cable")
                            .attr("x1", list1[ifather])
                            .attr("y1", y1)
                            .attr("x2", list2[ichild])
                            .attr("y2", y2);
                    }
                }
            }
        }
    }

    for (var i = 0; i < depth - 1; i++) {
        linePods(i, linePositions[i], linePositions[i + 1], i * hline, (i + 1) * hline);
        linePods(i, linePositions[i], linePositions[i + 1], -i * hline, -(i + 1) * hline);
    }

    drawHosts(linePositions[depth - 1], (depth - 1) * hline, 1);
    drawHosts(linePositions[depth - 1], -(depth - 1) * hline, -1);

    for (var i = 0; i < depth; i++) {
        if (i === 0) drawPods(linePositions[0], 0);
        else {
            drawPods(linePositions[i], i * hline);
            drawPods(linePositions[i], -i * hline);
        }
    }
}

/* =========================
   Controls (UNCHANGED)
========================= */
function formatNum(x) {
    x = x.toString();
    var pattern = /(-?\d+)(\d{3})/;
    while (pattern.test(x))
        x = x.replace(pattern, "$1,$2");
    return x;
}
function formInit() {
    var form = d3.select("form");

    function confInt() {
        conf[this.name] = parseInt(this.value);
        w = conf['width'];
        d = conf['depth'];
        var line = Math.pow(w, d - 1);

        var nhost = 2 * line * w;
        var nswitch = (2 * d - 1) * line;
        var ncable = (2 * d) * w * line;
        var ntx = 2 * (2 * d) * w * line;
        var nswtx = ntx - nhost;

        d3.select("#nhost").html(formatNum(nhost));
        d3.select("#nswitch").html(formatNum(nswitch));
        d3.select("#ncable").html(formatNum(ncable));
        d3.select("#ntx").html(formatNum(ntx));
        d3.select("#nswtx").html(formatNum(nswtx));
        redraw();
    }

    function hook(name, func) {
        var fields = form.selectAll("[name=" + name + "]");
        fields.on("change", func);
        fields.each(func);
    }

    hook("depth", confInt);
    hook("width", confInt);
}

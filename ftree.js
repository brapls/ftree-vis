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
function highlightPath(h1, h2) {
    var x1 = +h1.getAttribute("data-x");
    var x2 = +h2.getAttribute("data-x");
    var y1 = +h1.getAttribute("data-y");
    var y2 = +h2.getAttribute("data-y");

    // Get actual host positions from circle elements
    var h1cx = +h1.getAttribute("cx");
    var h1cy = +h1.getAttribute("cy");
    var h2cx = +h2.getAttribute("cx");
    var h2cy = +h2.getAttribute("cy");

    // Build a path set by collecting all cables to highlight
    var pathCables = new Set();

    // Get all cable elements
    var cables = [];
    d3.selectAll("line.cable").each(function () {
        cables.push({
            element: this,
            x1: +d3.select(this).attr("x1"),
            y1: +d3.select(this).attr("y1"),
            x2: +d3.select(this).attr("x2"),
            y2: +d3.select(this).attr("y2")
        });
    });

    // Mark the cables from hosts to their switches
    markCableBetweenPoints({x: h1cx, y: h1cy}, {x: x1, y: y1}, cables, pathCables);
    markCableBetweenPoints({x: h2cx, y: h2cy}, {x: x2, y: y2}, cables, pathCables);

    // Find path from host 1 upward
    var path1 = findPathUpward(x1, y1, cables);

    // Find path from host 2 upward
    var path2 = findPathUpward(x2, y2, cables);

    // Find common ancestor point (where paths meet at top)
    var commonPoint = findCommonPoint(path1, path2);

    // Mark cables in path1 from host to common point
    for (var i = 0; i < path1.length; i++) {
        var point = path1[i];
        if (point.x === commonPoint.x && point.y === commonPoint.y) break;

        var nextPoint = path1[i + 1];
        if (nextPoint) {
            markCableBetweenPoints(point, nextPoint, cables, pathCables);
        }
    }

    // Mark cables in path2 from common point to host 2
    var foundCommon = false;
    for (var i = path2.length - 1; i >= 0; i--) {
        var point = path2[i];
        if (point.x === commonPoint.x && point.y === commonPoint.y) {
            foundCommon = true;
            continue;
        }

        if (foundCommon) {
            var nextPoint = path2[i + 1];
            if (nextPoint) {
                markCableBetweenPoints(point, nextPoint, cables, pathCables);
            }
        }
    }

    // Apply highlight to marked cables
    cables.forEach(function(cable) {
        if (pathCables.has(cable)) {
            d3.select(cable.element).classed("highlight", true);
        }
    });
}

function findPathUpward(hostX, hostY, cables) {
    var path = [{x: hostX, y: hostY}];
    var current = {x: hostX, y: hostY};

    // Trace upward from host to the topmost layer
    while (current.y !== 0) {
        var nextPoint = null;

        // Find cable connected at y1 or y2 that goes to a different y
        for (var i = 0; i < cables.length; i++) {
            var cable = cables[i];

            if (Math.abs(cable.x1 - current.x) < 0.5 && Math.abs(cable.y1 - current.y) < 0.5) {
                nextPoint = {x: cable.x2, y: cable.y2};
                break;
            } else if (Math.abs(cable.x2 - current.x) < 0.5 && Math.abs(cable.y2 - current.y) < 0.5) {
                nextPoint = {x: cable.x1, y: cable.y1};
                break;
            }
        }

        if (nextPoint === null) break;
        path.push(nextPoint);
        current = nextPoint;
    }

    return path;
}

function findCommonPoint(path1, path2) {
    // Find the FIRST (lowest/closest to hosts) common point where paths meet
    // Start from the beginning of each path and find the first matching point
    for (var i = 0; i < path1.length; i++) {
        for (var j = 0; j < path2.length; j++) {
            var p1 = path1[i];
            var p2 = path2[j];
            if (Math.abs(p1.x - p2.x) < 0.5 && Math.abs(p1.y - p2.y) < 0.5) {
                return p1;
            }
        }
    }

    // Fallback: use the topmost point
    return path1[path1.length - 1];
}

function markCableBetweenPoints(point1, point2, cables, pathSet) {
    for (var i = 0; i < cables.length; i++) {
        var cable = cables[i];

        var startsAt1 = Math.abs(cable.x1 - point1.x) < 0.5 && Math.abs(cable.y1 - point1.y) < 0.5;
        var endsAt2 = Math.abs(cable.x2 - point2.x) < 0.5 && Math.abs(cable.y2 - point2.y) < 0.5;

        var startsAt2 = Math.abs(cable.x1 - point2.x) < 0.5 && Math.abs(cable.y1 - point2.y) < 0.5;
        var endsAt1 = Math.abs(cable.x2 - point1.x) < 0.5 && Math.abs(cable.y2 - point1.y) < 0.5;

        if ((startsAt1 && endsAt2) || (startsAt2 && endsAt1)) {
            pathSet.add(cable);
        }
    }
}

function fatTreeModel(depth, width) {
    var k = Math.floor(width / 2);
    var line = Math.pow(k, depth - 1);
    return {
        depth: depth,
        k: k,
        nhost: 2 * line * k,
        nswitch: (2 * depth - 1) * line,
        ncable: (2 * depth) * k * line,
        ntx: 2 * (2 * depth) * k * line,
        nswtx: 2 * (2 * depth) * k * line - 2 * line * k,
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

    var padg = width * 4;
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
        .attr("style", "margin-left: 200px;")
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
            .attr("r", hostr)
            .attr("data-x", x)
            .attr("data-y", y)
            .on("click", function () {
                selectHost(this);
            });
    }

    function drawHosts(list, y, direction) {
        var hostsPerSwitch = k;
        var hostOffsets = [];

        // Generate evenly spaced offsets for the hosts
        for (var h = 0; h < hostsPerSwitch; h++) {
            var offset = (h - (hostsPerSwitch - 1) / 2) * 4;
            hostOffsets.push(offset);
        }

        for (var i = 0; i < list.length; i++) {
            for (var j = 0; j < hostOffsets.length; j++) {
                drawHost(list[i], y, hhost * direction, hostOffsets[j]);
            }
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
function selectHost(hostElem) {

    // Clear previous path if starting fresh
    if (selectedHosts.length === 2) {
        selectedHosts = [];
        d3.selectAll(".highlight").classed("highlight", false);
        d3.selectAll(".selected").classed("selected", false);
    }

    selectedHosts.push(hostElem);
    d3.select(hostElem).classed("selected", true);

    if (selectedHosts.length === 2) {
        highlightPath(selectedHosts[0], selectedHosts[1]);
    }
}
/* =========================
   Controls (UNCHANGED)
========================= */
function formatNum(x) {
    console.log(x);
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
        var infoTable = fatTreeModel(d, w);
        d3.select("#nhost").html(formatNum(infoTable.nhost));
        d3.select("#nswitch").html(formatNum(infoTable.nswitch));
        d3.select("#ncable").html(formatNum(infoTable.ncable));
        d3.select("#ntx").html(formatNum(infoTable.ntx));
        d3.select("#nswtx").html(formatNum(infoTable.nswtx));
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

onload = () => {
    const tabFilters = [
        {
            label: 'All links',
        },
        {
            label: 'OGC Metamodel',
            filters: {
                prop: p => p.startsWith('http://www.opengis.net/def/metamodel/'),
            },
        },
        {
            label: 'OGC Spec',
            filters: {
                prop: p => p.startsWith('http://www.opengis.net/def/ont/specrel/'),
            }
        },
        {
            label: 'SKOS',
            filters: {
                prop: p => p.startsWith('http://www.w3.org/2004/02/skos/core#'),
            },
        },
    ];
    const ignoredLinks = [
        'http://www.opengis.net/def/metamodel/ogc-na/status',
    ];
    const incomingColor = 'red', outgoingColor = 'blue';
    const baseUrl = d3.select('body').attr('data-base-url');
    const height = 600;
    const padding = 10, margin = 10;

    function boundedBox() {
        let nodes, sizes, bounds;
        let size = () => [0, 0];

        const force = () => {
            for (const [i, node] of nodes.entries()) {
                const nodeSize = sizes[i];
                const xi = node.x + node.vx,
                    x0 = bounds[0][0] - xi,
                    x1 = bounds[1][0] - (xi + nodeSize[0]),
                    yi = node.y + node.vy,
                    y0 = bounds[0][1] - yi,
                    y1 = bounds[1][1] - (yi + nodeSize[1]);
                if (x0 > 0 || x1 < 0) {
                    node.x += node.vx;
                    node.vx = -node.vx;
                    if (node.vx < x0) {
                        node.x += x0 - node.vx;
                    }
                    if (node.vx > x1) {
                        node.x += x1 - node.vx;
                    }
                }
                if (y0 > 0 || y1 < 0) {
                    node.y += node.vy;
                    node.vy = -node.vy;
                    if (node.vy < y0) {
                        node.vy += y0 - node.vy;
                    }
                    if (node.vy > y1) {
                        node.vy += y1 - node.vy;
                    }
                }
            }
        };

        force.initialize = n => {
            sizes = (nodes = n).map(size)
        };

        force.bounds = (...b) => typeof b === 'undefined' ? bounds : (bounds = b, force);

        force.size = (s, ...x) => {
            if (typeof s === 'undefined') {
                return size;
            }
            size = typeof s === 'function' ? s : () => s;
            return force;
        };

        return force;
    }

    const profiles = [{
        label: "",
        filter: d => d.filter(item => Math.random() > 0.5),
    }];

    const toId = s => {
        return `_${s.replace(/^[a-zA-Z0-9-_]/, '_')}`;
    };

    const radian = (ux, uy, vx, vy) => {
        const dot = ux * vx + uy * vy;
        const mod = Math.sqrt( ( ux * ux + uy * uy ) * ( vx * vx + vy * vy ) );
        const rad = Math.acos( dot / mod );
        return ux * vy - uy * vx < 0.0 ? -rad : rad;
    }

    const svgArcToCenterParam = (x1, y1, rx, ry, phi, fA, fS, x2, y2) => {
        var cx, cy, startAngle, deltaAngle, endAngle;
        var PIx2 = Math.PI * 2.0;

        if (rx < 0) {
            rx = -rx;
        }
        if (ry < 0) {
            ry = -ry;
        }
        if (rx == 0.0 || ry == 0.0) { // invalid arguments
            throw Error('rx and ry can not be 0');
        }

        var s_phi = Math.sin(phi);
        var c_phi = Math.cos(phi);
        var hd_x = (x1 - x2) / 2.0;
        var hd_y = (y1 - y2) / 2.0;
        var hs_x = (x1 + x2) / 2.0;
        var hs_y = (y1 + y2) / 2.0;

        var x1_ = c_phi * hd_x + s_phi * hd_y;
        var y1_ = c_phi * hd_y - s_phi * hd_x;

        var lambda = (x1_ * x1_) / (rx * rx) + (y1_ * y1_) / (ry * ry);
        if (lambda > 1) {
            rx = rx * Math.sqrt(lambda);
            ry = ry * Math.sqrt(lambda);
        }

        var rxry = rx * ry;
        var rxy1_ = rx * y1_;
        var ryx1_ = ry * x1_;
        var sum_of_sq = rxy1_ * rxy1_ + ryx1_ * ryx1_; // sum of square
        var coe = Math.sqrt(Math.abs((rxry * rxry - sum_of_sq) / sum_of_sq));
        if (fA == fS) { coe = -coe; }

        var cx_ = coe * rxy1_ / ry;
        var cy_ = -coe * ryx1_ / rx;

        cx = c_phi * cx_ - s_phi * cy_ + hs_x;
        cy = s_phi * cx_ + c_phi * cy_ + hs_y;

        var xcr1 = (x1_ - cx_) / rx;
        var xcr2 = (x1_ + cx_) / rx;
        var ycr1 = (y1_ - cy_) / ry;
        var ycr2 = (y1_ + cy_) / ry;

        startAngle = radian(1.0, 0.0, xcr1, ycr1);

        deltaAngle = radian(xcr1, ycr1, -xcr2, -ycr2);
        while (deltaAngle > PIx2) { deltaAngle -= PIx2; }
        while (deltaAngle < 0.0) { deltaAngle += PIx2; }
        if (fS == false || fS == 0) { deltaAngle -= PIx2; }
        endAngle = startAngle + deltaAngle;
        while (endAngle > PIx2) { endAngle -= PIx2; }
        while (endAngle < 0.0) { endAngle += PIx2; }

        return {
            cx: cx,
            cy: cy,
            startAngle: startAngle,
            deltaAngle: deltaAngle,
            endAngle: endAngle,
            clockwise: (fS == true || fS == 1)
        }
    }

    const arcIntercept = (s, t, cx, cy, r, margin) => {
        let minDist = Infinity, x = null, y;
        const scenter = {x: (s.x + s.X) / 2, y: (s.y + s.Y) / 2}
        for (let yTest of [t.y, t.Y]) {
          let sqrt = Math.sqrt(r * r - (yTest - cy) * (yTest - cy));
          if (sqrt) {
            for (let xInt of [cx + sqrt, cx - sqrt]) {
              if (t.x <= xInt && t.X >= xInt) {
                let dist = Math.hypot(xInt - scenter.x, yTest - scenter.y);
                if (dist <= minDist) {
                  minDist = dist;
                  x = xInt;
                  y = yTest;
                }
              }
            }
          }
        }
        for (let xTest of [t.x, t.X]) {
          let sqrt = Math.sqrt(r * r - (xTest - cx) * (xTest - cx));
          if (sqrt) {
            for (let yInt of [cy + sqrt, cy - sqrt]) {
              if (t.y <= yInt && t.Y >= yInt) {
                let dist = Math.hypot(xTest - scenter.x, yInt - scenter.y);
                if (dist <= minDist) {
                  minDist = dist;
                  x = xTest;
                  y = yInt;
                }
              }
            }
          }
        }

        if (x !== null) {
            return {
              x: x + (x <= t.x ? -margin : margin),
              y: y + (y <= t.y ? -margin : margin),
            };
        }
        return null;
    };

    const linkArc = (d) => {
        const margin = 4;

        const [s, t] = [d.source, d.target].map(r => r.innerBounds);
        let [start, end] = [s, t].map(r => ({
          x: (r.x + r.X) / 2,
          y: (r.y + r.Y) / 2,
        }));
        const r = Math.hypot(end.x - start.x, end.y - start.y);

        const {cx, cy} = svgArcToCenterParam(start.x, start.y, r, r, 0, 0, 0, end.x, end.y);

        end = arcIntercept(s, t, cx, cy, r, margin) || end;
        start = arcIntercept(t, s, cx, cy, r, 0) || start;

        d.arc = { start, end, r, cx, cy };

        return `
            M${start.x},${start.y}
            A${r},${r} 0 0,0 ${end.x},${end.y}
        `;
    }

    d3.selectAll('.neighbors-graph').each(async function() {
        const wrapper = d3.select(this);
        const width = wrapper.node().offsetWidth;
        var loadedData = null;

        const color = d3.scaleOrdinal(d3.schemePastel2);

        const simulation = d3.forceSimulation()
            .alphaTarget(0.3);

        const tabs = wrapper.append('div')
            .attr('class', 'tabs')
            .selectAll('.tab')
            .data(tabFilters)
            .join(enter => enter.append('a')
                .attr('href', '#')
                .attr('class', 'tab')
                .classed('active', (d, i) => !i)
                .text(d => d.label)
            )
            .on('click', function(ev, d) {
                ev.preventDefault();
                const $this = d3.select(this);
                if ($this.classed('active')) {
                    return;
                }
                tabs.classed('active', false);
                $this.classed('active', true);
                update(d.filters);
            });

        const svg = wrapper.append("svg")
            .attr("width", width)
            .attr("height", height);

        const legend = wrapper.append("div")
            .attr('class', 'legend');

        svg.append("defs").append("marker")
              .attr("id", d => `arrow-outgoing`)
              .attr("viewBox", "0 -5 10 10")
              .attr("refX", 5)
              .attr("refY", -0.5)
              .attr("markerWidth", 6)
              .attr("markerHeight", 6)
              .attr("orient", "auto")
            .append("path")
              .attr("fill", outgoingColor)
              .attr("d", "M0,-5L10,0L0,5");

        svg.append("defs").append("marker")
              .attr("id", d => `arrow-incoming`)
              .attr("viewBox", "0 -5 10 10")
              .attr("refX", 5)
              .attr("refY", -0.5)
              .attr("markerWidth", 6)
              .attr("markerHeight", 6)
              .attr("orient", "auto")
            .append("path")
              .attr("fill", incomingColor)
              .attr("d", "M0,-5L10,0L0,5");

        const hcModal = svg.select('.high-cardinality-modal');
        var hcStatus = {
            items: [],
            total: 0,
            start: 0,
        };

        var nodes, links;

        const [sourceRes, sourceLabel, sourceType] = [
            wrapper.attr('data-res'),
            wrapper.attr('data-label'),
            wrapper.attr('type'),
        ];
        params = new URLSearchParams({ res: sourceRes });

        let node;

        let dragParams = {};
        const drag = d3.drag()
            .on('start', (ev, d) => {
                node.filter(n => n.res === d.res).raise();
                if (d.res === sourceRes) {
                    dragParams = null;
                } else {
                    dragParams = {
                        pos: [ev.x, ev.y],
                        offset: [ev.x - d.x, ev.y - d.y],
                    };
                    d.fx = d.x;
                    d.fy = d.y;
                }
            })
            .on('drag', (ev, d) => {
                if (!dragParams) {
                    return;
                }
                d.fx = Math.max(Math.min((dragParams.pos[0] = ev.x) - dragParams.offset[0], width - d.width), 0);
                d.fy = Math.max(Math.min((dragParams.pos[1] = ev.y) - dragParams.offset[1], height - d.height), 0);
            })
            .on('end', (ev, d) => {
                if (dragParams) {
                    d.fx = null;
                    d.fy = null;
                }
            });

        const update = function(filters) {

            const legendClasses = [...new Map(nodes.filter(d => d.type).map(d => [d.type, d])).values()];
            legend.selectAll('.legend-entry')
                .data(legendClasses)
                .join(
                    enter => {
                        const e = enter.append('div')
                            .attr('class', 'legend-entry')
                            .attr('title', d => d.type);
                        e.append('span')
                            .attr('class', 'legend-entry-marker')
                            .style('background-color', d => color(d.type));
                        e.append('span')
                            .attr('class', 'legend-entry-label')
                            .text(d => d.typeLabel);
                        return e;
                    }
                );

            var fNodes = nodes, fLinks = links;

            if (filters) {
                if (filters.res) {
                    fNodes = fNodes.filter(n => n.res == sourceRes || filters.res(n.res));
                    fLinks = fLinks.filter(l => filters.res(fNodes[l.source].res)
                        || filters.res(fNodes[l.target].res));
                }
                if (filters.prop) {
                    fLinks = fLinks.filter(l => filters.prop(l.prop));
                    let filteredNodes = fLinks.map(l => l.source.res == sourceRes ? l.target.res : l.source.res);
                    fNodes = fNodes.filter(n => n.res == sourceRes || filteredNodes.includes(n.res));
                }
            }

            const linkCount = {};
            fLinks.forEach(l => {
                const n = l.source.res == sourceRes ? l.target.res : l.source.res;
                linkCount[n] = (linkCount[n] || 0) + 1;
            });

            const link = svg.selectAll(".link")
                .data(fLinks, d => d.id)
                .join(
                    enter => enter.append("path"),
                    u => u,
                    exit => exit.remove())
                        .attr("class", "link")
                        .attr("fill", "none")
                        .attr("stroke", d => d.outgoing ? outgoingColor : incomingColor)
                        .attr("stroke-width", "1.5px")
                        .attr("stroke-opacity", "1")
                        .attr("marker-end", d => `url(${new URL(`#arrow-${d.outgoing ? 'outgoing' : 'incoming'}`, location)})`) ;

            const linkLabelPath = svg.selectAll('.link-label-path')
                .data(fLinks, d => d.id)
                .join(
                    enter => enter.append("path"),
                    u => u,
                    exit => exit.remove()
                )
                    .attr('class', 'link-label-path')
                    .attr('fill', 'none')
                    .attr('stroke-width', '1px')
                    .attr('id', d => `link-label-path-${toId(d.source.res)}-${toId(d.target.res)}`);

            const linkLabel = svg.selectAll('.link-label')
                .data(fLinks, d => d.id)
                .join(
                    enter => {
                        const t = enter.append("text");
                        t.append('textPath')
                            .attr('startOffset', '50%')
                            .attr('xlink:href', d => `#link-label-path-${toId(d.source.res)}-${toId(d.target.res)}`)
                            .text(d => d.label);
                        return t;
                    },
                    u => u,
                    exit => exit.remove()
                )
                    .attr('class', 'link-label')
                    .attr('text-anchor', 'middle')
                    .attr('font-size', '10px');

            node = svg.selectAll('.node')
                .data(fNodes, d => d.res)
                .join(
                    enter => {
                        const g = enter.append("g")
                            .attr('class', 'node')
                            .attr('data-uri', d => d.res);
                        g.append('rect')
                            .attr('rx', 5)
                            .attr('ry', 5)
                            .attr('stroke', 'white')
                            .attr('stroke-width', '1.5px')
                            .attr('cursor', d => d.res === sourceRes ? null : 'pointer')
                            .style("fill", d => color(d.highCardinality ? 'highCardinality' : d.type))
                            .on('click', (ev, d) => {
                                if (d.res) {
                                    window.location = `${baseUrl}/object?uri=${encodeURIComponent(d.res)}`;
                                }
                            })
                            .on('mouseover', (ev, d) => {
                                if (d.res === sourceRes) {
                                    return;
                                }
                                [link, linkLabel].forEach(x =>
                                    x.style('opacity', function(l) {
                                        return [l.source.res, l.target.res].includes(d.res) ? (d3.select(this).raise(), 1) : 0.1;
                                    }));
                                node.style('opacity', function(n) {
                                    return [d.res, sourceRes].includes(n.res) ? (d3.select(this).raise(), 1) : 0.4;
                                });
                            })
                            .on('mouseout', (ev, d) => {
                                [node, link, linkLabel].forEach(x => x.style('opacity', 1));
                                node.raise();
                            })
                            .call(drag)
                            .append("title")
                            .filter(d => d.label)
                            .text(d => d.label);
                        g.append('text')
                            .attr("class", "label")
                            .attr("cursor", d => d.highCardinality ? "help" : "pointer")
                            .attr("font-size", "12px")
                            .attr('style', 'pointer-events: none')
                            .attr('data-uri', d => d.res)
                            .text(function (d) {
                                if (d.highCardinality) {
                                    return `${d.count} resources`;
                                }
                                return d.res != sourceRes && d.label.length > 30 ? d.label.substring(0, 29) + "…" : d.label;
                            })
                            .each(function(d) {
                                var bb = this.getBBox();
                                d.width = bb.width + 2 * padding + margin;
                                d.height = bb.height + 2 * padding + margin;
                                if (d.res == sourceRes) {
                                    d.fx = (width - d.width) / 2;
                                    d.fy = (height - d.height) / 2;
                                }
                            });
                        return g;
                    },
                    u => u,
                    exit => exit.remove()
                );

            link.lower();
            linkLabel.lower();

            simulation.nodes(fNodes)
                .force('charge', d3.forceManyBody().strength(-300))
                .force('link', d3.forceLink(links)
                    .distance(d => 150 + (20 * Math.random()) + 50 * (linkCount[d.source.res == sourceRes ? d.target.res : d.source.res] || 1))
                    .strength(0.01))
                .force('box', boundedBox().bounds([0, 0], [width, height]).size(d => [d.width, d.height]))
                //.force('x', d3.forceX(width / 2))
                //.force('y', d3.forceY(height / 2));
                .force('radial', d3.forceRadial(d => Math.min(width, height) / (5 - 2 * ((linkCount[d.res] || 1) - 1)), width / 2, height / 2))

            simulation.on("tick", function () {
                node.each(function(d) {
                        d.innerBounds = {
                            x: d.x + margin / 2,
                            y: d.y + margin / 2,
                            width: d.width - margin,
                            height: d.height - margin,
                        };
                        d.innerBounds.X = d.innerBounds.x + d.innerBounds.width;
                        d.innerBounds.Y = d.innerBounds.y + d.innerBounds.height;
                    })
                node.selectAll('rect').attr("x", d => d.innerBounds.x)
                    .attr("y", d => d.innerBounds.y)
                    .attr("width", d => d.innerBounds.width)
                    .attr("height", d => d.innerBounds.height);

                link.attr("d", linkArc);

                linkLabelPath.attr("d", d => {
                    let { start, end, r, cx, cy } = d.arc;
                    let sweep = 0, offset = 5;
                    if (start.x > end.x) {
                        [start, end] = [end, start];
                        sweep = 1;
                        offset = 10;
                    }
                    const aStart = Math.atan2(start.y - cy, start.x - cx),
                        aEnd = Math.atan2(end.y - cy, end.x - cx);
                    return `
                        M${start.x - Math.cos(aStart) * offset},${start.y - Math.sin(aStart) * offset}
                        A${r},${r} 0 0,${sweep} ${end.x - Math.cos(aEnd) * offset},${end.y - Math.sin(aEnd) * offset}
                    `;
                });

                node.selectAll('.label').attr("x", function (d) { return d.innerBounds.x + padding })
                     .attr("y", function (d) {
                         var h = this.getBBox().height;
                         return d.innerBounds.y + d.innerBounds.height / 2 - h / 2 + padding;
                     });
            });
        };

        d3.json(`${baseUrl}/neighbors?${params}`)
            .then(data => {
                const sourceNode = { res: sourceRes, label: sourceLabel, type: sourceType };
                nodes = [sourceNode];
                links = [];
                const seen = { sourceRes: 0 };
                const linkCount = {};

                const addItem = (item) => {
                    let node = seen[item.resource.value];
                    if (!node) {
                        node = {
                            res: item.resource.value,
                            label: item.label.value,
                            type: item.type.value,
                            typeLabel: item.typeLabel?.value ?? item.type.value.replace(/^.*[#/]/, ''),
                        };
                        node.index = nodes.push(node) - 1;
                        seen[item.resource.value] = node;
                    }
                    return node;
                };

                const addLink = (item, highCardinality) => {
                    if (ignoredLinks.includes(item.prop.value)) {
                        return;
                    }
                    const outgoing = item.outgoing.value !== 'false';
                    let node;
                    if (highCardinality) {
                        node = {
                            highCardinality: true,
                            prop: item.prop.value,
                            count: item.count.value,
                            id: `${item.prop.value} hc`,
                        };
                        node.index = nodes.push(node) - 1;
                    } else {
                        node = addItem(item);
                    }
                    links.push({
                        source: outgoing ? sourceNode : node,
                        target: outgoing ? node : sourceNode,
                        prop: item.prop.value,
                        label: item.propLabel?.value ?? item.prop.value.replace(/^.*[#/]/, ''),
                        id: `${item.prop.value} ${item.resource.value} ${outgoing}`,
                        outgoing,
                    });
                    links[links.length - 1].index = links.length - 1;
                    linkCount[node.res] = (linkCount[node.res] ?? 0) + 1
                };

                data.links.forEach(i => addLink(i, false));
                data.highCardinality.forEach(i => addLink(i, true));
                update(tabFilters[0]?.filter);
            });
    });
};
onload = () => {
    const ignoredLinks = [
        'http://www.opengis.net/def/metamodel/ogc-na/status',
    ];
    const ignoredTypes = [
        // SKOS!
    ];
    const incomingColor = 'red', outgoingColor = 'blue';
    const baseUrl = d3.select('body').attr('data-base-url');
    const height = 600;
    const groupPadding = 20;
    const padding = 10, margin = 10;

    const profiles = [{
        label: "",
        filter: d => d.filter(item => Math.random() > 0.5),
    }];

    const toId = s => {
        return `_${s.replace(/^[a-zA-Z0-9-_]/, '_')}`;
    };

    const radian = (ux, uy, vx, vy) => {
        var dot = ux * vx + uy * vy;
        var mod = Math.sqrt( ( ux * ux + uy * uy ) * ( vx * vx + vy * vy ) );
        var rad = Math.acos( dot / mod );
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

    const linkArc = (d) => {
        const margin = 4;

        const [s, t] = [d.source, d.target].map(r => r.innerBounds);
        let [start, end] = [s, t].map(r => ({
          x: (r.x + r.X) / 2,
          y: (r.y + r.Y) / 2,
        }));
        const r = Math.hypot(end.x - start.x, end.y - start.y);

        const {cx, cy} = svgArcToCenterParam(start.x, start.y, r, r, 0, 0, 0, end.x, end.y);

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
            end = {
              x: x + (x <= t.x ? -margin : margin),
              y: y + (y <= t.y ? -margin : margin),
            };
        }

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

        // Profile selector
        wrapper.append('button')
            .text('Click me')
            .on('click', () => {
                if (loadedData) {
                    //update(loadedData.filter(d => Math.random() > 0.5));
                    update({
                        highCardinality: loadedData.highCardinality,
                        links: loadedData.links.filter(d => Math.random() > 0.5),
                    });
                }
            });

        const color = d3.scaleOrdinal(d3.schemePastel2);

        const instance = cola.d3adaptor(d3)
            .avoidOverlaps(true)
            //.jaccardLinkLengths(150)
            .size([width, height]);

        const svg = wrapper.append("svg")
            .attr("width", width)
            .attr("height", height);

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

        const [sourceRes, sourceLabel, sourceType] = [
            wrapper.attr('data-res'),
            wrapper.attr('data-label'),
            wrapper.attr('type'),
        ];
        params = new URLSearchParams({ res: sourceRes });

        const update = function(data) {
            const nodes = [{ res: sourceRes, label: sourceLabel, type: sourceType }];
            const links = [];
            const vocgroups = {};
            const seen = { sourceRes: 0 };
            const linkCount = {};

            const addItem = (item) => {
                let idx = seen[item.resource.value];
                if (!idx) {
                    idx = nodes.push({
                        res: item.resource.value,
                        label: item.label.value,
                        type: item.type.value,
                        typeLabel: item.typeLabel?.value ?? item.type.value.replace(/^.*[#/]/, ''),
                    }) - 1;
                    seen[item.resource.value] = idx;
                    const voc = item.resource.value.replace(/^(.*[#/]).*/, '$1');
                    let voclist = vocgroups[voc];
                    if (!voclist) {
                        vocgroups[voc] = [idx];
                    } else {
                        voclist.push(idx);
                    }
                }
                return idx;
            };

            const addLink = (item, highCardinality) => {
                if ((item.type && ignoredTypes.includes(item.type.value))
                        || ignoredLinks.includes(item.prop.value)) {
                    return;
                }
                const outgoing = item.outgoing.value !== 'false';
                const idx = !highCardinality ? addItem(item) : nodes.push({
                        highCardinality: true,
                        prop: item.prop.value,
                        count: item.count.value,
                        id: `${item.prop.value} hc`,
                    }) - 1;
                links.push({
                    source: outgoing ? 0 : idx,
                    target: outgoing ? idx : 0,
                    prop: item.prop.value,
                    label: item.propLabel?.value ?? item.prop.value.replace(/^.*[#/]/, ''),
                    id: `${item.prop.value} ${item.resource.value} ${outgoing}`,
                    outgoing,
                });
                linkCount[idx] = (linkCount[idx] ?? 0) + 1
            };

            data.links.forEach(i => addLink(i, false));
            data.highCardinality.forEach(i => addLink(i, true));
            const groups = Object.entries(vocgroups).map(([voc, leaves]) => ({ voc, leaves, padding: groupPadding }));

            instance
                .linkDistance(d => 120 * (linkCount[d.source || d.target] || 1))
                .nodes(nodes)
                .links(links)
                .groups(groups)
                .start(10, 10, 10);

            var group = svg.selectAll(".group")
                .data(groups, d => d.voc);
            group.exit().remove();
            group = group.enter().append("rect")
                .attr("rx", 8).attr("ry", 8)
                .attr("class", "group")
                .style("fill", function (d, i) { return color(i); })
                .merge(group);

            var link = svg.selectAll(".link")
                .data(links, d => d.id);
            link.exit().remove();
            link = link.enter().append("path")
                .attr("class", "link")
                .attr("fill", "none")
                .attr("stroke", d => d.outgoing ? outgoingColor : incomingColor)
                .attr("stroke-width", "1.5px")
                .attr("stroke-opacity", "1")
                .attr("marker-end", d => `url(${new URL(`#arrow-${d.outgoing ? 'outgoing' : 'incoming'}`, location)})`)
                .merge(link);

            var linkLabelPath = svg.selectAll('.link-label-path')
                .data(links, d => d.id);
            linkLabelPath.exit().remove();
            linkLabelPath = linkLabelPath.enter().append('path')
                .attr('class', 'link-label-path')
                .attr('fill', 'none')
                .attr('stroke-width', '1px')
                .attr('id', d => `link-label-path-${toId(d.source.res)}-${toId(d.target.res)}`)
                .merge(linkLabelPath);

            var linkLabel = svg.selectAll('.link-label')
                .data(links, d => d.id);
            linkLabel.exit().remove();
            var linkLabelEnter = linkLabel.enter().append("text")
                .attr('class', 'link-label')
                .attr('text-anchor', 'middle')
                .attr('font-size', '10px')
            linkLabelEnter.append('textPath')
                .attr('startOffset', '50%')
                .attr('xlink:href', d => `#link-label-path-${toId(d.source.res)}-${toId(d.target.res)}`)
                .text(d => d.label);
            linkLabel = linkLabelEnter.merge(linkLabel);

            var node = svg.selectAll(".node")
                .data(nodes, d => d.res);
            node.exit().remove();
            var nodeEnter = node.enter().append("rect")
                .attr("class", "node")
                .attr("rx", 5).attr("ry", 5)
                .attr("stroke", "white")
                .attr("stroke-width", "1.5px")
                .attr("cursor", d => d.highCardinality ? "help" : "pointer")
                .on('click', function(d) {
                    if (d.res) {
                        window.location = d.res;
                    }
                })
            nodeEnter.append("title")
                .filter(d => d.label)
                .text(function (d) { return d.label; });
            node = nodeEnter.merge(node)
                .style("fill", function (d) { return color(groups.length + (d.highCardinality ? 1 : 0)); });

            var label = svg.selectAll(".label")
                .data(nodes, d => d.res);
                label.exit().remove();
            var labelEnter = label.enter().append("text")
                .attr("class", "label")
                .attr("text-anchor", "middle")
                .attr("cursor", d => d.highCardinality ? "help" : "pointer")
                .attr("font-size", "12px")
                .attr('style', 'pointer-events: none')
                .text(function (d) {
                    if (d.highCardinality) {
                        return `${d.count} resources`;
                    }
                    return d.index && d.label.length > 30 ? d.label.substring(0, 29) + "…" : d.label;
                })
            labelEnter.append("title")
                .filter(d => d.label)
                .text(d => d.label);
            label = labelEnter.merge(label)
                .each(function(d) {
                    var bb = this.getBBox();
                    d.width = bb.width + padding + 2 * margin;
                    d.height = bb.height + padding + 2 * margin;
                    if (!d.index) {
                        d.width += 8 * margin;
                        d.height += 8 * margin;
                    }
                });

            var popup = svg.append('g')
                .attr('class', 'node-detail')
                .style('opacity', 0);

            popup.append('rect')
                .attr('class', 'popup-node')
                .attr("rx", 5).attr("ry", 5)
                .attr("stroke", "white")
                .attr("stroke-width", "1.5px")
                .attr("cursor", "pointer")
                .style("fill", function (d) { return color(groups.length); });

            popup.append('text')
                .attr('class', 'popup-label')
                .attr("text-anchor", "middle")
                .attr("cursor", "pointer")
                .attr("font-size", "12px");

            link.lower();
            linkLabel.lower();
            group.lower();

            instance.on("tick", function () {
                node.each(function(d) { d.innerBounds = d.bounds.inflate(- (d.index ? margin : 4 * margin)) })
                    .attr("x", function (d) { return d.innerBounds.x; })
                    .attr("y", function (d) { return d.innerBounds.y; })
                    .attr("width", function(d) { return d.innerBounds.width() })
                    .attr("height", function(d) { return d.innerBounds.height() });

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

                group.attr("x", function (d) { return d.bounds.x + groupPadding / 2; })
                     .attr("y", function (d) { return d.bounds.y + groupPadding / 2; })
                    .attr("width", function (d) { return d.bounds.width() - groupPadding })
                    .attr("height", function (d) { return d.bounds.height() - groupPadding });

                label.attr("x", function (d) { return d.x })
                     .attr("y", function (d) {
                         var h = this.getBBox().height;
                         return d.y + padding / 2;
                     });
            });
        };

        d3.json(`${baseUrl}/neighbors?${params}`, function (data) {
            loadedData = data;
            update(data);
        });
    });
};
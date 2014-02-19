d3.fbo = function() {
  var fbo = {},
      nodeHeight = 24,
      nodePadding = 8,
      size = [1, 1],
      real_size = [1, 1],
      nodes = [],
      links = [],
      groups = [];

  fbo.nodeHeight = function(_) {
    if (!arguments.length) return nodeHeight;
    nodeHeight = +_;
    return fbo;
  };

  fbo.nodePadding = function(_) {
    if (!arguments.length) return nodePadding;
    nodePadding = +_;
    return fbo;
  };

  fbo.nodes = function(_) {
    if (!arguments.length) return nodes;
    nodes = _;
    return fbo;
  };

  fbo.links = function(_) {
    if (!arguments.length) return links;
    links = _;
    return fbo;
  };

  fbo.groups = function(_) {
    if (!arguments.length) return groups;
    groups = _;
    return fbo;
  };

  fbo.size = function(_) {
    if (!arguments.length) return real_size;
    real_size = _;
    size[0] = real_size[0] - nodePadding;
    size[1] = real_size[1] - nodePadding;
    return fbo;
  };

  fbo.layout = function(iterations) {
    computeNodeLinks();
    computeNodeValues();
    computeNodeBreadths();
    computeNodeDepths(iterations);
    computeLinkDepths();
    return fbo;
  };

  fbo.relayout = function() {
    computeLinkDepths();
    return fbo;
  };

  fbo.link = function() {
    var curvature = .5;

    function link(d) {
      var y0 = d.source.y + d.source.dy,
          y1 = d.target.y,
          yi = d3.interpolateNumber(y0, y1),
          y2 = yi(curvature),
          y3 = yi(1 - curvature),
          x0 = d.source.x + d.sx + d.source.dx / 2,
          x1 = d.target.x + d.tx + d.target.dx / 2;
      return "M" + x0 + "," + y0
           + "C" + x0 + "," + y2
           + " " + x1 + "," + y3
           + " " + x1 + "," + y1;
    }

    link.curvature = function(_) {
      if (!arguments.length) return curvature;
      curvature = +_;
      return link;
    };

    return link;
  };

  // Populate the sourceLinks and targetLinks for each node.
  // Also, if the source and target are not objects, assume they are indices.
  function computeNodeLinks() {
    nodes.forEach(function(node) {
      node.sourceLinks = [];
      node.targetLinks = [];
    });
    links.forEach(function(link) {
      var source = link.source,
          target = link.target;
      if (typeof source === "number") source = link.source = nodes[link.source];
      if (typeof target === "number") target = link.target = nodes[link.target];
      source.sourceLinks.push(link);
      target.targetLinks.push(link);
    });
  }

  // Compute the value (size) of each node by summing the associated links.
  function computeNodeValues() {
    nodes.forEach(function(node) {
      node.value = node.columns;
      //console.log("Node columns: " + node.columns);
    });
    
    links.forEach(function(link) {
      link.value = link.source.columns;
    });
  }

  // Iteratively assign the breadth (x-position) for each node.
  // Nodes are assigned the maximum breadth of incoming neighbors plus one;
  // nodes with no incoming links are assigned breadth zero, while
  // nodes with no outgoing links are assigned the maximum breadth.
   function computeNodeBreadths() {
  
    get_group_order = function(arr, a_group){
      arr.forEach(function(group){
        if (group.name == a_group)
          return group.order;
      });  
    };

    var group_map = d3.nest()
        .key(function(d) { return d.name; })
        .entries(groups);
  
    var nodesByGroup = d3.nest()
        .key(function(d) { return d.group; })
        .sortKeys(function(a, b) {
            return get_group_order(groups, b) < get_group_order(groups, a) ? -1 : get_group_order(groups, b) > get_group_order(groups, a) ? 1 : 0;
          })
        .entries(nodes);
  
    var y = 0;
    var last_group_y = 0;

    nodesByGroup.forEach(function(pair) {
      console.log("Node nodes2: " + pair.key);
      var remainingNodes = pair.values,
          nextNodes;

      while (remainingNodes.length) {
        nextNodes = [];
        console.log("New iteration");
        remainingNodes.forEach(function(node) {
          node.y = y;
          node.dy = nodeHeight;
          console.log("Node name: " + node.name + ", group: " + node.group + ", y: " + node.y);
          node.sourceLinks.forEach(function(link) {
            if (link.target.group == pair.key){
              nextNodes.push(link.target);
            }
          });
        });
        remainingNodes = nextNodes;
        ++y;
      }
      
      moveSinksRight(y, pair.key);
      
      groups.forEach(function(group){
        if (group.name == pair.key)
        {
          group.x = 0;
          group.dx = width ;
          group.y = last_group_y;
          group.dy = y - last_group_y;
          console.log("group name: " + group.name + ", group.x: " + group.x  + ", group.dx: " + group.dx + ", group.y: " + group.y + ", group.dy: " + group.dy );
        }
      });        
      last_group_y = y;
    });
 
    scaleNodeBreadths((size[1] - nodeHeight) / (y - 1));
  }
  
  function moveSourcesRight() {
    nodes.forEach(function(node) {
      if (!node.targetLinks.length) {
        node.y = d3.min(node.sourceLinks, function(d) { return d.target.y; }) - 1;
      }
    });
  }

  function moveSinksRight(y, phase) {
    nodes
      .filter(function(value, index, ar){
        return (value.group == phase);
        })
      .forEach(function(node) {
        if (!node.sourceLinks.length) {
          node.y = y - 1;
        }
      });
  }

  function scaleNodeBreadths(ky) {
    nodes.forEach(function(node) {
      node.y *= ky;
      node.y += nodePadding/2;
    });
    
    groups.forEach(function(group) {
      group.y *= ky;
      group.dy *= ky;
      console.log("Group name: " + group.name + ", x: " + group.x + ", y: " + group.y + ", dx: " + group.dx + ", dy: " + group.dy);
    });
  }

  function computeNodeDepths(iterations) {
    var nodesByBreadth = d3.nest()
        .key(function(d) { return d.y; })
        .sortKeys(d3.ascending)
        .entries(nodes)
        .map(function(d) { return d.values; });

    //
    initializeNodeDepth();
    resolveCollisions();
    for (var alpha = 1; iterations > 0; --iterations) {
      relaxRightToLeft(alpha *= .99);
      resolveCollisions();
      relaxLeftToRight(alpha);
      resolveCollisions();
    }

    function initializeNodeDepth() {
      var kx = d3.min(nodesByBreadth, function(nodes) {
        return (size[0] - (nodes.length - 1) * nodePadding) / d3.sum(nodes, value);
      });

      nodesByBreadth.forEach(function(nodes) {
        nodes.forEach(function(node, i) {
          node.x = i;
          node.dx = node.value * kx;
        });
      });

      links.forEach(function(link) {
        link.dx = link.value * kx;
      });
    }

    function relaxLeftToRight(alpha) {
      nodesByBreadth.forEach(function(nodes, breadth) {
        nodes.forEach(function(node) {
          if (node.targetLinks.length) {
            var x = d3.sum(node.targetLinks, weightedSource) / d3.sum(node.targetLinks, value);
            node.x += (x - center(node)) * alpha;
          }
        });
      });

      function weightedSource(link) {
        return center(link.source) * link.value;
      }
    }

    function relaxRightToLeft(alpha) {
      nodesByBreadth.slice().reverse().forEach(function(nodes) {
        nodes.forEach(function(node) {
          if (node.sourceLinks.length) {
            var x = d3.sum(node.sourceLinks, weightedTarget) / d3.sum(node.sourceLinks, value);
            node.x += (x - center(node)) * alpha;
          }
        });
      });

      function weightedTarget(link) {
        return center(link.target) * link.value;
      }
    }

    function resolveCollisions() {
      nodesByBreadth.forEach(function(nodes) {
        var node,
            dx,
            x0 = 0,
            n = nodes.length,
            i;

        // Push any overlapping nodes down.
        nodes.sort(ascendingDepth);
        for (i = 0; i < n; ++i) {
          node = nodes[i];
          dx = x0 - node.x;
          if (dx > 0) node.x += dx;
          x0 = node.x + node.dx + nodePadding;
        }

        // If the bottommost node goes outside the bounds, push it back up.
        dx = x0 - nodePadding - size[0];
        if (dx > 0) {
          x0 = node.x -= dx;

          // Push any overlapping nodes back up.
          for (i = n - 2; i >= 0; --i) {
            node = nodes[i];
            dx = node.x + node.dx + nodePadding - x0;
            if (dx > 0) node.x -= dx;
            x0 = node.x;
          }
        }
      });
    }

    function ascendingDepth(a, b) {
      return a.x - b.x;
    }
  }

  function computeLinkDepths() {
    nodes.forEach(function(node) {
      node.sourceLinks.sort(ascendingTargetDepth);
      node.targetLinks.sort(ascendingSourceDepth);
    });
    nodes.forEach(function(node) {
      var sx = 0, tx = 0;
      node.sourceLinks.forEach(function(link) {
        link.sx = sx;
        //sy += link.dy;
      });
      node.targetLinks.forEach(function(link) {
        link.tx = tx;
        //ty += link.dy;
      });
    });

    function ascendingSourceDepth(a, b) {
      return a.source.x - b.source.x;
    }

    function ascendingTargetDepth(a, b) {
      return a.target.x - b.target.x;
    }
  }

  function center(node) {
    return node.x + node.dx / 2;
  }

  function value(link) {
    return link.value;
  }

  return fbo;
};
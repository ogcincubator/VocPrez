from rdflib import URIRef, Literal


class Property(object):
    def __init__(self, uri: str, label: str, value: URIRef or Literal, value_label: str = None,
                 tooltip=None):
        self.uri = uri
        self.label = label
        self.value = value
        self.value_label = value_label
        self.tooltip = tooltip

    def get_tooltip(self, trim=200, ellipsis='…'):
        if not self.tooltip:
            return self.tooltip
        return self.tooltip[:trim] + (ellipsis if len(self.tooltip) > trim else '')
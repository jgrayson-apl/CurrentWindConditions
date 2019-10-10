/*
 | Copyright 2016 Esri
 |
 | Licensed under the Apache License, Version 2.0 (the "License");
 | you may not use this file except in compliance with the License.
 | You may obtain a copy of the License at
 |
 |    http://www.apache.org/licenses/LICENSE-2.0
 |
 | Unless required by applicable law or agreed to in writing, software
 | distributed under the License is distributed on an "AS IS" BASIS,
 | WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 | See the License for the specific language governing permissions and
 | limitations under the License.
 */
define([
  "calcite",
  "boilerplate/ItemHelper",
  "boilerplate/UrlParamHelper",
  "dojo/i18n!./nls/resources",
  "dojo/_base/declare",
  "dojo/_base/lang",
  "dojo/_base/Color",
  "dojo/colors",
  "dojo/number",
  "dojo/query",
  "dojo/on",
  "dojo/dom",
  "dojo/dom-attr",
  "dojo/dom-class",
  "dojo/dom-geometry",
  "dojo/dom-construct",
  "esri/identity/IdentityManager",
  "esri/core/watchUtils",
  "esri/core/promiseUtils",
  "esri/portal/Portal",
  "esri/layers/Layer",
  "esri/widgets/Home",
  "esri/widgets/Search",
  "esri/widgets/LayerList",
  "esri/widgets/Legend",
  "esri/widgets/Expand"
], function(calcite, ItemHelper, UrlParamHelper, i18n, declare, lang, Color, colors, number, query, on,
            dom, domAttr, domClass, domGeom, domConstruct,
            IdentityManager, watchUtils, promiseUtils, Portal, Layer,
            Home, Search, LayerList, Legend,  Expand){

  return declare(null, {

    config: null,
    direction: null,

    /**
     *
     * @param boilerplateResponse
     */
    init: function(boilerplateResponse){

      calcite.init();

      if(boilerplateResponse){
        this.direction = boilerplateResponse.direction;
        this.config = boilerplateResponse.config;
        this.settings = boilerplateResponse.settings;
        const boilerplateResults = boilerplateResponse.results;
        const webMapItem = boilerplateResults.webMapItem;
        const webSceneItem = boilerplateResults.webSceneItem;
        const groupData = boilerplateResults.group;

        document.documentElement.lang = boilerplateResponse.locale;

        this.urlParamHelper = new UrlParamHelper();
        this.itemHelper = new ItemHelper();

        this._setDirection();

        if(webMapItem){
          this._createWebMap(webMapItem);
        } else if(webSceneItem){
          this._createWebScene(webSceneItem);
        } else {
          this.reportError(new Error("app:: Could not load an item to display"));
        }
      } else {
        this.reportError(new Error("app:: Boilerplate is not defined"));
      }
    },

    /**
     *
     * @param error
     * @returns {*}
     */
    reportError: function(error){
      // remove loading class from body
      //domClass.remove(document.body, CSS.loading);
      //domClass.add(document.body, CSS.error);
      // an error occurred - notify the user. In this example we pull the string from the
      // resource.js file located in the nls folder because we've set the application up
      // for localization. If you don't need to support multiple languages you can hardcode the
      // strings here and comment out the call in index.html to get the localization strings.
      // set message
      let node = dom.byId("loading_message");
      if(node){
        //node.innerHTML = "<h1><span class=\"" + CSS.errorIcon + "\"></span> " + i18n.error + "</h1><p>" + error.message + "</p>";
        node.innerHTML = "<h1><span></span>" + i18n.error + "</h1><p>" + error.message + "</p>";
      }
      return error;
    },

    /**
     *
     * @private
     */
    _setDirection: function(){
      let direction = this.direction;
      let dirNode = document.getElementsByTagName("html")[0];
      domAttr.set(dirNode, "dir", direction);
    },

    /**
     *
     * @param webMapItem
     * @private
     */
    _createWebMap: function(webMapItem){
      this.itemHelper.createWebMap(webMapItem).then(map => {

        let viewProperties = {
          map: map,
          container: this.settings.webmap.containerId
        };

        if(!this.config.title && map.portalItem && map.portalItem.title){
          this.config.title = map.portalItem.title;
        }

        lang.mixin(viewProperties, this.urlParamHelper.getViewProperties(this.config));
        require(["esri/views/MapView"], MapView => {

          let view = new MapView(viewProperties);
          view.when(() => {
            this.urlParamHelper.addToView(view, this.config);
            this._ready(view);
          }, this.reportError);

        });
      }, this.reportError);
    },

    /**
     *
     * @param webSceneItem
     * @private
     */
    _createWebScene: function(webSceneItem){
      this.itemHelper.createWebScene(webSceneItem).then(map => {

        let viewProperties = {
          map: map,
          container: this.settings.webscene.containerId
        };

        if(!this.config.title && map.portalItem && map.portalItem.title){
          this.config.title = map.portalItem.title;
        }

        lang.mixin(viewProperties, this.urlParamHelper.getViewProperties(this.config));
        require(["esri/views/SceneView"], SceneView => {

          let view = new SceneView(viewProperties);
          view.when(() => {
            this.urlParamHelper.addToView(view, this.config);
            this._ready(view);
          }, this.reportError);
        });
      }, this.reportError);
    },

    /**
     *
     * @private
     */
    _ready: function(view){

      // TITLE //
      document.title = dom.byId("app-title-node").innerHTML = this.config.title;

      // LOADING //
      const updatingNode = dom.byId("loading-node");
      view.ui.add(updatingNode, "bottom-right");
      watchUtils.init(view, "updating", (updating) => {
        domClass.toggle(updatingNode, "is-active", updating);
      });

      // SEARCH //
      const search = new Search({ view: view });
      search.includeDefaultSources = (evt) => {
        //console.info("includeDefaultSources: ", evt);
        evt.defaultSources.getItemAt(0).zoomScale = 2500000;
        return evt.defaultSources.toArray();
      };
      //search.sources.getItemAt(0).zoomScale = 2500000;
      view.ui.add(search, { position: "top-left", index: 0 });


      // HOME //
      const home = new Home({ view: view });
      view.ui.add(home, { position: "top-left", index: 1 });

      // VIEW HIGHLIGHT //
      view.highlightOptions = {
        color: Color.named.cyan,
        haloOpacity: 0.8,
        fillOpacity: 0.2
      };


      this.initializeCurrentWinds(view);

    },

    /**
     *
     * @param view
     */
    initializeCurrentWinds: function(view){


      // 1c512074959f424491e41934a6b9a62a //
      Layer.fromPortalItem({ portalItem: { id: "dfbdfdf98f604da1a49f317e8f619352" } }).then(windsLayer => {
        windsLayer.load().then(() => {
          windsLayer.outFields = ["*"];

          //windsLayer.opacity = 0.8;
          windsLayer.refreshInterval = 2.5;
          windsLayer.elevationInfo = {
            mode: "relative-to-scene",
            offset: 10000
          };

          const labelsThreshold = 2500000.0;
          windsLayer.labelsVisible = true;
          windsLayer.labelingInfo = [
            {
              where: "WIND_SPEED > 30 AND TEMP > 90",
              labelExpressionInfo: {
                expression: "Round($feature.WIND_SPEED,1) + ' km/h' + TextFormatting.NewLine + Round($feature.TEMP,1) + ' F'"
              },
              labelPlacement: "above-center",
              maxScale: labelsThreshold,
              symbol: {
                type: "label-3d",
                symbolLayers: [
                  {
                    type: "text",
                    size: 15,
                    material: { color: Color.named.red },
                    halo: {
                      size: 1,
                      color: Color.named.darkred.concat(0.5)
                    }
                  }
                ]
              }
            },
            {
              where: "WIND_SPEED > 30 AND TEMP <= 90",
              labelExpressionInfo: { expression: "Round($feature.WIND_SPEED,1) + ' km/h' " },
              labelPlacement: "above-center",
              maxScale: labelsThreshold,
              symbol: {
                type: "label-3d",
                symbolLayers: [
                  {
                    type: "text",
                    material: { color: Color.named.lightblue },
                    size: 13
                  }
                ]
              }
            },
            {
              where: "WIND_SPEED <= 30 AND TEMP > 90",
              labelExpressionInfo: { expression: "Round($feature.TEMP,1) + ' F'" },
              labelPlacement: "above-center",
              maxScale: labelsThreshold,
              symbol: {
                type: "label-3d",
                symbolLayers: [
                  {
                    type: "text",
                    material: { color: Color.named.lightyellow },
                    size: 13
                  }
                ]
              }
            },
            {
              labelExpressionInfo: { expression: "Round($feature.WIND_SPEED,1) + ' km/h    ' + Round($feature.TEMP,1) + ' F'" },
              labelPlacement: "above-center",
              minScale: labelsThreshold,
              symbol: {
                type: "label-3d",
                symbolLayers: [
                  {
                    type: "text",
                    material: { color: Color.named.white },
                    size: 11,
                    halo: {
                      color: "#666",
                      size: 1
                    }
                  }
                ]
              }
            }
          ];

          const arrowSymbol = {
            type: "point-3d",
            symbolLayers: [
              {
                type: "object",
                resource: { primitive: "cylinder" },
                material: { color: Color.named.red },
                anchor: "bottom",
                width: 5000.0,
                depth: 5000.0,
                height: 5000.0,
                tilt: 90.0
              },
              {
                type: "object",
                resource: { primitive: "inverted-cone" },
                material: { color: Color.named.lime },
                anchor: "top",
                width: 15000.0,
                depth: 15000.0,
                height: 15000.0,
                tilt: 90.0
              }
            ]
          };

          const renderer = windsLayer.renderer.clone();
          renderer.classBreakInfos.forEach(cbi => {
            cbi.symbol = arrowSymbol;
          });
          renderer.visualVariables = renderer.visualVariables.concat([
            {
              type: "rotation",
              axis: "heading",
              valueExpression: `$feature.WIND_DIRECT + 90.0`
            },
            {
              type: "size",
              field: "WIND_SPEED",
              axis: "height",
              minDataValue: 0,
              maxDataValue: 118,
              minSize: 15000,
              maxSize: 150000
            },
            {
              type: "size",
              axis: "width-and-depth",
              useSymbolValue: true
            }
          ]);
          windsLayer.renderer = renderer;

          view.map.add(windsLayer);

          const labelsContainer = domConstruct.create("div", { className: "panel panel-dark-blue" });
          view.ui.add(labelsContainer, { position: "bottom-left", index: 1 });

          // LABELS TOGGLE //
          const labelsPanel = domConstruct.create("div", { className: "panel panel-dark-blue" }, labelsContainer);
          const labelsToggle = domConstruct.create("label", { className: "toggle-switch" }, labelsPanel);
          domConstruct.create("span", {
            className: "toggle-switch-label font-size--3 margin-right-quarter left",
            innerHTML: "Display Temp and Wind Labels"
          }, labelsToggle);
          const labelsInput = domConstruct.create("input", {
            type: "checkbox",
            checked: windsLayer.labelsVisible,
            className: "toggle-switch-input"
          }, labelsToggle);
          domConstruct.create("span", {
            className: "toggle-switch-track left"
          }, labelsToggle);

          on(labelsInput, "change", () => {
            windsLayer.labelsVisible = labelsInput.checked;
          });

          // LEGEND //
          const legend = new Legend({ container: domConstruct.create("div", {}, labelsContainer), view: view });


          const skyConditionsNode = domConstruct.create("div", { className: "panel panel-dark-blue animate-fade-in hide" });
          view.ui.add(skyConditionsNode, "top-right");
          const updateSkyConditions = (skyConditions) => {
            domClass.toggle(skyConditionsNode, "hide", (skyConditions == null));
            skyConditionsNode.innerHTML = skyConditions || "";
          };

          let highlight = null;
          view.whenLayerView(windsLayer).then((windsLayerView) => {
            watchUtils.whenFalseOnce(windsLayerView, "updating", () => {

              view.on("pointer-move", (evt) => {
                if(highlight){ highlight.remove(); }

                view.hitTest(evt, { include: [windsLayer] }).then((hitTestResponse) => {
                  const result = (hitTestResponse.results.length > 0) ? hitTestResponse.results[0] : null;
                  if(result){
                    highlight = windsLayerView.highlight(result.graphic);
                    const atts = result.graphic.attributes;
                    updateSkyConditions(`${atts.STATION_NAME}: ${atts.SKY_CONDTN || "N/A"}`);
                  } else {
                    updateSkyConditions();
                  }
                });
              });

              const findMaxObsDate = (features, maxObsDate) => {
                return features.reduce((maxObsDate, feature) => {
                  const obsDate = +feature.attributes["OBS_DATETIME"];
                  return (maxObsDate != null) ? Math.max(maxObsDate, obsDate) : obsDate;
                }, maxObsDate);
              };

              const lastUpdateLabel = dom.byId("last-update-label");

              let maxObsDate = null;
              watchUtils.whenDefined(windsLayerView, "controller", () => {

                const updateFeatureCount = () => {
                  const features = windsLayerView.controller.graphics;
                  const update_latest_label = (features_array) => {
                    maxObsDate = findMaxObsDate(features_array, maxObsDate);
                    lastUpdateLabel.innerHTML = (new Date(maxObsDate)).toLocaleTimeString();
                    lastUpdateLabel.title = number.format(features.length);
                  };
                  update_latest_label(features.toArray());
                };
                updateFeatureCount();

                /*features.on("change", (evt) => {
                  if(evt.added && evt.added.length) {
                    update_latest_label(evt.added);
                  }
                });*/

                on(dom.byId("last-update-node"), "click", () => {
                  windsLayer.refresh();
                  updateFeatureCount();
                });

              });
            });
          });
        });
      });

    }

  });
});


/*
OBJECTID ( type: esriFieldTypeOID , alias: OBJECTID )
Shape ( type: esriFieldTypeGeometry , alias: Shape )
ICAO ( type: esriFieldTypeString , alias: Station Identification , length: 4 )
OBS_DATETIME ( type: esriFieldTypeDate , alias: Observation Date/Time , length: 8 )
STATION_NAME ( type: esriFieldTypeString , alias: Station Name , length: 125 )
COUNTRY ( type: esriFieldTypeString , alias: Country Name , length: 50 )
ELEVATION ( type: esriFieldTypeSingle , alias: Station Elevation (Meters) )
TEMP ( type: esriFieldTypeSingle , alias: Air Temperature (°F) )
DEW_POINT ( type: esriFieldTypeSingle , alias: Dew Point Temperature (°F) )
R_HUMIDITY ( type: esriFieldTypeSmallInteger , alias: Relative Humidity (%) )
WIND_DIRECT ( type: esriFieldTypeSmallInteger , alias: Wind Origin (Degrees) )
WIND_SPEED ( type: esriFieldTypeSmallInteger , alias: Wind Speed (km/h) )
WIND_GUST ( type: esriFieldTypeSmallInteger , alias: Wind Gust (km/h) )
WIND_CHILL ( type: esriFieldTypeSingle , alias: Wind Chill (°F) )
VISIBILITY ( type: esriFieldTypeInteger , alias: Horizontal Visibility (Meters) )
PRESSURE ( type: esriFieldTypeSingle , alias: Altimeter Pressure (Millibars) )
SKY_CONDTN ( type: esriFieldTypeString , alias: Sky Conditions , length: 255 )
WEATHER ( type: esriFieldTypeString , alias: Weather Conditions , length: 255 )
REMARKS ( type: esriFieldTypeString , alias: Remarks , length: 255 )
HEAT_INDEX ( type: esriFieldTypeSingle , alias: Heat Feels Like (°F) )
LATITUDE ( type: esriFieldTypeSingle , alias: Location Latitude (DD) )
LONGITUDE ( type: esriFieldTypeSingle , alias: Location Longitude (DD) )
 */

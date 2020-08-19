/*从wfs请求坐标信息，在坐标位置添加h5格式label,label默认不接收鼠标事件，里边内容要接收鼠标事件，请在内部元素添加pointer-events属性
此方法添加label为批量添加，layername图层内的每一条记录添加一个label
url：wfs服务地址
layerName:图层名称，图层中应该有X,Y  字段，值为经纬度坐标
html：label内容，为html格式字符串
maxHeight:显示的最大航高条件。
minHeight:显示的最小航高条件。
本方法引用了addHtmlLabelM方法
本方法引用了showByHeight方法
*/
function addHtmlLabelBylayer(viewer, url, layerName, html, maxHeight, minHeight) {
	$.get(
		url,
		{
			request: 'GetFeature',
			version: '1.1.0',
			typename: layerName,
			outputformat: 'json',
		},
		function (date) {
			for (var i = 0; i < date.features.length; i++) {
				var temFeature = date.features[i];
				var coodX = temFeature.properties.X;
				var coodY = temFeature.properties.Y;
				var inforLabelID = addHtmlLabelM(viewer, coodX, coodY, html, i);
				var inforLabel = document.getElementById(inforLabelID);
				inforLabel.style.pointerEvents = 'none';
				showByHeight(viewer, maxHeight, minHeight, inforLabel);
			}
		}
	);
}
/*根据坐标在指定位置生成html格式的label
coodX，coodY为经纬度坐标
html：label内容，为html格式字符串
divid：为html最外层div的ID值序号，市级ID使用默认前缀“popup_”
返回值：div的ID
*/
function addHtmlLabelM(viewer, coodX, coodY, html, divid) {
	var Popup = function (info) {
		this.constructor(info);
	};
	Popup.prototype.constructor = function (info) {
		var _this = this;
		_this.viewer = info.viewer; //弹窗创建的viewer
		_this.geometry = info.geometry; //弹窗挂载的位置
		_this.id = 'popup_' + info.id;
		_this.ctn = $("<div style='position: absolute;z-index: 999;' class='bx-popup-ctn' id =  '" + _this.id + "'>");
		$(_this.viewer.container).append(_this.ctn);
		_this.ctn.append(_this.createHtml(info.html)); //嵌入的HTML代码
		_this.render(_this.geometry);
		_this.eventListener = _this.viewer.clock.onTick.addEventListener(function (clock) {
			_this.render(_this.geometry);
		});
	};
	Popup.prototype.render = function (geometry) {
		var _this = this;
		var position = Cesium.SceneTransforms.wgs84ToWindowCoordinates(_this.viewer.scene, geometry);
		_this.ctn.css('left', position.x - _this.ctn.get(0).offsetWidth / 2);
		_this.ctn.css('top', position.y - _this.ctn.get(0).offsetHeight / 2);
	};
	Popup.prototype.createHtml = function (html) {
		return html;
	};
	Popup.prototype.close = function () {
		var _this = this;
		_this.ctn.remove();
		_this.viewer.clock.onTick.removeEventListener(_this.eventListener);
	};

	function addInfo(viewer, option) {
		var popup = new Popup({
			viewer: viewer,
			geometry: option.position,
			html: option.html,
			id: option.divid,
		});
		return popup.id;
	}

	var option = { viewer: viewer, position: Cesium.Cartesian3.fromDegrees(coodX, coodY, 0), html: html, divid: divid };
	var inforLabelID = addInfo(viewer, option);
	// console.log(inforLabelID);
	return inforLabelID;
}
/*根据航高设置div的显示
maxHeight：最大航高
minHeight：最小航高
div:div元素
*/
function showByHeight(viewer, maxHeight, minHeight, div) {
	var canvas = viewer.scene.canvas;
	var handler = new Cesium.ScreenSpaceEventHandler(canvas);
	handler.setInputAction(function (movement) {
		var alti = viewer.camera.positionCartographic.height / 1000;
		if (alti > maxHeight) {
			div.style.visibility = 'hidden';
		} else if (alti < minHeight) {
			div.style.visibility = 'hidden';
		} else {
			div.style.visibility = 'visible';
		}
		// }
	}, Cesium.ScreenSpaceEventType.WHEEL);
}
/*在线绘制多段线，左键点击绘制，右键结束绘制。
  调用外部方法:catchPoint,refreshLayer
  调用returnSmallLayername，用于返回小图层名：dxm:dxm_point------>dxm_point
  url:wfs服务地址
  layername:图层名称，例如：dxm_line
  fieldValues：格式为 { id: 99999, name: 'ceshi'};即为添加图形的属性
  */

function addPLOnline(viewer, url, layername, fieldValues) {
	if (fieldValues['ID'] == undefined) {
		console.log('ID值为空');
		return;
	}
	var myFirstPromise = new Promise(function (resolve, reject) {
		checkId(resolve, reject, url, layername, fieldValues['ID']);
	});
	myFirstPromise.then(function (successMessage) {
		if (successMessage > 0) {
			console.log('存在重复ID元素');
			return;
		} else {
			var canvas = viewer.scene.canvas;
			var catchHandler = new Cesium.ScreenSpaceEventHandler(canvas);
			var handler = new Cesium.ScreenSpaceEventHandler(canvas);
			var positions = [];
			catchPoint(
				viewer,
				'darwPoint',
				function (newpoint) {
					var ellipsoid = viewer.scene.globe.ellipsoid;
					var cartesian3 = ellipsoid.cartographicToCartesian(newpoint);
					positions.push(cartesian3);
					if (positions.length > 1) {
						drawPL('temPL', positions);
					}
					handler.setInputAction(function (movement) {
						var temPositions = positions.concat();
						var cartesian = viewer.camera.pickEllipsoid(movement.endPosition, ellipsoid);
						temPositions.push(cartesian);
						drawPL('temPL2', temPositions);
					}, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
					handler.setInputAction(function () {
						handler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE);
						if (Cesium.defined(viewer.entities.getById('temPL2'))) {
							viewer.entities.remove(viewer.entities.getById('temPL2'));
							synPLOnline(viewer, url, layername, fieldValues, positions);
							handler.destroy();
							catchHandler.destroy();
						}
					}, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
				},
				true,
				catchHandler
			);
		}
	});

	function synPLOnline(viewer, url, layername, fieldValues, positions) {
		getPropertyNamesFromGeoserver(url, layername, function (propertyNames) {
			if (positions.length < 2) {
				return;
			}
			var header =
				'<?xml version="1.0"?> ' +
				'<wfs:Transaction ' +
				'version="1.1.0" ' +
				'service="WFS" ' +
				'xmlns:gml="http://www.opengis.net/gml" ' +
				'xmlns:ogc="http://www.opengis.net/ogc" ' +
				'xmlns:wfs="http://www.opengis.net/wfs" ' +
				'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ' +
				'xsi:schemaLocation="http://www.someserver.com/myns> ' +
				'http://www.someserver.com/wfs/cwwfs.cgi?  ' +
				'request=describefeaturetype&amp;typename=' +
				returnSmallLayername(layername) +
				'.xsd ' +
				'http://www.opengis.net/wfs ../wfs/1.1.0/WFS.xsd"> ' +
				' <wfs:Insert idgen="UseExisting"> ' +
				'<' +
				returnSmallLayername(layername) +
				'> ';
			var geo = '<the_geom> ' + '<MultiLineString srsname="EPSG_4326">';
			var cartographicPositions = Cesium.Ellipsoid.WGS84.cartesianArrayToCartographicArray(positions);
			geo = geo + '<lineStringMember>' + '<gml:LineString>';
			for (var i = 0; i < cartographicPositions.length; i++) {
				var lat = Cesium.Math.toDegrees(cartographicPositions[i].latitude);
				var lng = Cesium.Math.toDegrees(cartographicPositions[i].longitude);
				geo = geo + '<gml:coord><X>' + lng + '</X><Y>' + lat + '</Y></gml:coord>';
			}
			geo = geo + '</gml:LineString>' + '</lineStringMember>';
			geo = geo + '</MultiLineString>' + '</the_geom> ';
			var properties = '';
			for (var p in propertyNames) {
				properties += '<' + p + '>' + fieldValues[p] + '</' + p + '>';
			}
			var footer = '</' + returnSmallLayername(layername) + '> ' + '</wfs:Insert> ' + '</wfs:Transaction> ';
			xml = header + geo + properties + footer;
			$.ajax({
				type: 'POST',
				url: url,
				data: xml,
				contentType: 'text/plain;charset=UTF-8',
				success: function (data) {
					viewer.entities.remove(viewer.entities.getById('temPL'));
					refreshLayer(viewer, url, layername);
				},
				error: function (err) {
					console.log(err);
				},
			});
		});
	}
	function drawPL(id, positions) {
		if (Cesium.defined(viewer.entities.getById(id))) {
			viewer.entities.remove(viewer.entities.getById(id));
		}
		viewer.entities.add({
			id: id,
			polyline: {
				positions: positions,
				material: Cesium.Color.RED,
				width: 1,
			},
		});
	}
}
function updatePointOnline(viewer, url, layername) {
	var canvas = viewer.scene.canvas;
	var handler = new Cesium.ScreenSpaceEventHandler(canvas);
	var catchHandler = new Cesium.ScreenSpaceEventHandler(canvas);
	var flag = 0;
	var labelText;
	var pointID;
	handler.setInputAction(function (movement) {
		var ellipsoid = viewer.scene.globe.ellipsoid;
		var cartesian = viewer.camera.pickEllipsoid(movement.endPosition, ellipsoid);
		var updateLabel = viewer.entities.getById('updateLabel');
		if (flag == 0) {
			labelText = '请选择要修改的点';
			if (Cesium.defined(updateLabel)) {
				viewer.entities.remove(updateLabel);
				viewer.entities.add({
					id: 'updateLabel',
					position: cartesian,
					label: {
						text: labelText,
						font: '12px 黑体',
						verticalOrigin: Cesium.VerticalOrigin.TOP,
						horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
						pixelOffset: new Cesium.Cartesian2(5, -15),
						fillColor: Cesium.Color.BLACK,
						showBackground: true,
						backgroundColor: Cesium.Color.SILVER,
					},
				});
			} else {
				viewer.entities.add({
					id: 'updateLabel',
					position: cartesian,
					label: {
						text: labelText,
						font: '12px 黑体',
						verticalOrigin: Cesium.VerticalOrigin.TOP,
						horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
						pixelOffset: new Cesium.Cartesian2(5, -15),
						fillColor: Cesium.Color.BLACK,
						showBackground: true,
						backgroundColor: Cesium.Color.SILVER,
					},
				});
			}
		}
	}, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
	handler.setInputAction(function (movement) {
		if (flag == 0) {
			var pickRay = viewer.camera.getPickRay(movement.position);
			var featuresPromise = viewer.imageryLayers.pickImageryLayerFeatures(pickRay, viewer.scene);
			if (!Cesium.defined(featuresPromise)) {
				console.log('No features picked.');
			} else {
				Cesium.when(featuresPromise, function (features) {
					if (features.length > 0) {
						if (features[0].imageryLayer._imageryProvider._layers == layername) {
							flag = 1;
							pointID = features[0].data.id;
							var updateLabel = viewer.entities.getById('updateLabel');
							if (Cesium.defined(updateLabel)) {
								viewer.entities.remove(updateLabel);
							}
							catchPoint(
								viewer,
								'darwPoint',
								function (newpoint) {
									var lat = Cesium.Math.toDegrees(newpoint.latitude);
									var log = Cesium.Math.toDegrees(newpoint.longitude);
									var header =
										'<?xml version="1.0" ?>' +
										'<wfs:Transaction ' +
										'version="1.1.0" ' +
										'service="WFS" ' +
										'xmlns="http://www.someserver.com/myns" ' +
										'xmlns:gml="http://www.opengis.net/gml" ' +
										'xmlns:ogc="http://www.opengis.net/ogc" ' +
										'xmlns:wfs="http://www.opengis.net/wfs" ' +
										'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ' +
										'xsi:schemaLocation="http://www.opengis.net/wfs ../wfs/1.1.0/WFS.xsd"> ' +
										'<wfs:Update typeName="' +
										layername +
										'"> ';
									var geo =
										'<wfs:Property> ' +
										'<wfs:Name>' +
										'the_geom' +
										'</wfs:Name> ' +
										'<wfs:Value>' +
										'<gml:Point ' +
										'srsName="EPSG:4326"> ' +
										'<gml:coord><X>' +
										Number(log) +
										'</X><Y>' +
										Number(lat) +
										'</Y></gml:coord> ' +
										'</gml:Point> ' +
										'</wfs:Value> ' +
										'</wfs:Property> ';
									var filter = '<ogc:Filter> ' + '<ogc:GmlObjectId id="' + features[0].data.id + '"/> ' + '</ogc:Filter> ';
									var footer = ' </wfs:Update> ' + '</wfs:Transaction> ';
									var xml = header + geo + filter + footer;
									$.ajax({
										type: 'POST',
										url: url,
										data: xml,
										contentType: 'text/plain;charset=UTF-8',
										success: function (data) {
											refreshLayer(viewer, url, layername);
										},
										error: function (err) {
											console.log(err);
										},
									});
									// });
								},
								false,
								catchHandler
							);
						}
					}
				});
			}
		}
	}, Cesium.ScreenSpaceEventType.LEFT_CLICK);
	handler.setInputAction(function () {
		catchHandler.destroy();
		viewer.entities.remove(viewer.entities.getById('pointLabel'));
		handler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE);
		viewer.entities.remove(viewer.entities.getById('updateLabel'));
		handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
	}, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
}

/*在线添加点：前端绘制点，录入属性，同时将图形和属性同步到后端
url：wfs服务地址。
layername:目标图层名称
fieldValues：格式为 { dode: 99999, fclass: 'ceshi', flag: 1 };
调用getPropertyNamesFromGeoserver，获取字段名称和类型,并使用其回调函数添加点。
调用addGeoServer，用于重新加载图层
调用returnSmallLayername，用于返回小图层名：dxm:dxm_point------>dxm_point
 */
function addPointOnline(viewer, url, layername, fieldValues) {
	if (fieldValues['ID'] == undefined) {
		console.log('ID值为空');
		return;
	}
	var myFirstPromise = new Promise(function (resolve, reject) {
		checkId(resolve, reject, url, layername, fieldValues['ID']);
	});
	myFirstPromise.then(function (successMessage) {
		if (successMessage > 0) {
			console.log('存在重复Id元素');
			return;
		} else {
			var canvas = viewer.scene.canvas;
			var handler = new Cesium.ScreenSpaceEventHandler(canvas);
			var catchHandler = new Cesium.ScreenSpaceEventHandler(canvas);
			getPropertyNamesFromGeoserver(url, layername, function (propertyNames) {
				catchPoint(
					viewer,
					'darwPoint',
					function (newPoint) {
						// console.log(newPoint);
						var lat = Cesium.Math.toDegrees(newPoint.latitude);
						var log = Cesium.Math.toDegrees(newPoint.longitude);
						var header =
							'<wfs:Transaction ' +
							' version="1.1.0" ' +
							' service="WFS" ' +
							' xmlns:gml="http://www.opengis.net/gml" ' +
							' xmlns:wfs="http://www.opengis.net/wfs" >' +
							'<wfs:Insert idgen="UseExisting"> ' +
							'<' +
							returnSmallLayername(layername) +
							'> ';
						var geo =
							'<the_geom>' +
							'<gml:Point ' +
							'srsName="EPSG:4326"> ' +
							'<gml:coord><X>' +
							Number(log) +
							'</X><Y>' +
							Number(lat) +
							'</Y></gml:coord> ' +
							'</gml:Point> ' +
							'</the_geom> ';
						var properties = '';
						for (var p in propertyNames) {
							properties += '<' + p + '>' + fieldValues[p] + '</' + p + '>';
						}
						var footer = '</' + returnSmallLayername(layername) + '>' + '</wfs:Insert>' + '</wfs:Transaction>';
						var xml = header + geo + properties + footer;
						$.ajax({
							type: 'POST',
							url: url,
							data: xml,
							contentType: 'text/plain;charset=UTF-8',
							success: function (data) {
								console.log(data);
								refreshLayer(viewer, url, layername);
							},
							error: function (err) {
								console.log(err);
							},
						});
					},
					false,
					catchHandler
				);
				handler.setInputAction(function () {
					catchHandler.destroy();
					viewer.entities.remove(viewer.entities.getById('pointLabel'));
				}, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
			});
		}
	});
}
function removeByGeoID(viewer, url, layername, geoId) {
	var header =
		'<?xml version="1.0" ?> ' +
		'<wfs:Transaction ' +
		'version="1.1.0" ' +
		'service="WFS" ' +
		'xmlns="http://www.someserver.com/myns" ' +
		'xmlns:ogc="http://www.opengis.net/ogc" ' +
		'xmlns:wfs="http://www.opengis.net/wfs" ' +
		'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" >';
	var body =
		'<wfs:Delete typeName="' +
		layername +
		'"> ' +
		'<ogc:Filter> ' +
		'<ogc:GmlObjectId id="' +
		geoId +
		'"/> ' +
		'</ogc:Filter> ' +
		'</wfs:Delete> ';
	var footer = '</wfs:Transaction> ';
	var xml = header + body + footer;
	$.ajax({
		type: 'POST',
		url: url,
		data: xml,
		contentType: 'text/plain;charset=UTF-8',
		success: function (data) {
			refreshLayer(viewer, url, layername);
		},
		error: function (err) {
			console.log(err);
		},
	});
}
/*在线删除要素：通过左键点击事件执行删除
url：wfs服务地址。
layername:目标图层名称
*/
function removeOnline(viewer, url, layername) {
	var canvas = viewer.scene.canvas;
	var handler = new Cesium.ScreenSpaceEventHandler(canvas);
	var handler2 = new Cesium.ScreenSpaceEventHandler(canvas);
	handler.setInputAction(function (movement) {
		var pickRay = viewer.camera.getPickRay(movement.position);
		var featuresPromise = viewer.imageryLayers.pickImageryLayerFeatures(pickRay, viewer.scene);
		if (!Cesium.defined(featuresPromise)) {
			console.log('No features picked.');
		} else {
			Cesium.when(featuresPromise, function (features) {
				if (features.length > 0) {
					if (features[0].imageryLayer._imageryProvider._layers == layername) {
						var header =
							'<?xml version="1.0" ?> ' +
							'<wfs:Transaction ' +
							'version="1.1.0" ' +
							'service="WFS" ' +
							'xmlns="http://www.someserver.com/myns" ' +
							'xmlns:ogc="http://www.opengis.net/ogc" ' +
							'xmlns:wfs="http://www.opengis.net/wfs" ' +
							'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" >';
						var body =
							'<wfs:Delete typeName="' +
							layername +
							'"> ' +
							'<ogc:Filter> ' +
							'<ogc:GmlObjectId id="' +
							features[0].data.id +
							'"/> ' +
							'</ogc:Filter> ' +
							'</wfs:Delete> ';
						var footer = '</wfs:Transaction> ';
						var xml = header + body + footer;
						$.ajax({
							type: 'POST',
							url: url,
							data: xml,
							contentType: 'text/plain;charset=UTF-8',
							success: function (data) {
								handler2.destroy();
								viewer.entities.remove(viewer.entities.getById('removeOnline'));
								refreshLayer(viewer, url, layername);
							},
							error: function (err) {
								console.log(err);
							},
						});
					}
				}
			});
		}
		handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
	}, Cesium.ScreenSpaceEventType.LEFT_CLICK);
	addLabelByMove(handler2, '请选择移除对象', 'removeOnline');
	handler.setInputAction(function () {
		handler2.destroy();
		viewer.entities.remove(viewer.entities.getById('removeOnline'));
		handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
	}, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
}
/*从wfs服务中搜索，并将搜索结果高亮显示，支持模糊查询
url:wfs服务地址
layerName：搜索的图层
cearchFild：搜索的字段
searchKey：搜索的内容，即关键词
flyFlag：是否缩放到
*/
function searchFromGeoserver(viewer, url, layerName, cearchFild, searchKey, flyFlag) {
	$.get(
		url,
		{
			cql_filter: cearchFild + " like '%" + searchKey + "%'",
			request: 'GetFeature',
			version: '1.1.0',
			typename: layerName,
			outputformat: 'json',
		},
		function (date) {
			console.log(date);
			var minX = 180;
			var maxX = 0;
			var minY = 90;
			var maxY = 0;
			if (date.features.length == 0) {
				return;
			}
			for (var j = 0; j < date.features.length; j++) {
				var coordinates = date.features[j].geometry.coordinates[0][0];
				var arr = [];
				for (var i = 0; i < coordinates.length; i++) {
					arr = arr.concat(coordinates[i]);
					if (coordinates[i][0] > maxX) {
						maxX = coordinates[i][0];
					}
					if (coordinates[i][0] < minX) {
						minX = coordinates[i][0];
					}
					if (coordinates[i][1] > maxY) {
						maxY = coordinates[i][1];
					}
					if (coordinates[i][1] < minY) {
						minY = coordinates[i][1];
					}
				}
				try {
					var greenPolygon = viewer.entities.add({
						id: date.features[j].id,
						name: 'searchFromGeoserver',
						polygon: {
							hierarchy: Cesium.Cartesian3.fromDegreesArray(arr),
							material: Cesium.Color.DEEPPINK.withAlpha(0.1),
							closeTop: false,
							closeBottom: false,
						},
					});
				} catch (err) {}
			}
			if (flyFlag == true) {
				viewer.camera.flyTo({
					destination: Cesium.Rectangle.fromDegrees(minX, minY, maxX, maxY),
				});
			}

			var canvas = viewer.scene.canvas;
			var handler = new Cesium.ScreenSpaceEventHandler(canvas);
			handler.setInputAction(function (movement) {
				var obj = viewer.scene.pick(movement.position);
				try {
					if (obj.id.name == 'searchFromGeoserver') {
						viewer.entities.remove(obj.id);
						obj.id = null;
					}
				} catch (err) {}
			}, Cesium.ScreenSpaceEventType.LEFT_CLICK);
		}
	);
}
/*从geoserver中遍历出指定图层都有哪些字段
url:服务地址
layername:图层名称
callback：回调函数，参数为获取的图层字段结构{字段名称：数据类型}
*/
function getPropertyNamesFromGeoserver(url, layerName, callback) {
	var propertyNames = {};
	$.get(
		url,
		{
			request: 'DescribeFeatureType',
			version: '1.1.0',
			typename: layerName,
		},
		function (data) {
			if (data.getElementsByTagName('xsd:sequence').length > 0) {
				for (var i = 1; i < data.getElementsByTagName('xsd:sequence')[0].children.length; i++) {
					var propertyName = data.getElementsByTagName('xsd:sequence')[0].children[i].attributes.name.nodeValue;
					var propertyType = data.getElementsByTagName('xsd:sequence')[0].children[i].attributes.type.nodeValue;
					propertyNames[propertyName] = propertyType;
				}
				callback(propertyNames);
			}
		}
	);
}
/*添加wms服务
filePath,wms服务地址
layer:图层名称
返回值：cesium影像图层
*/
function addGeoServer(viewer, filePath, layers) {
	var provider = new Cesium.WebMapServiceImageryProvider({
		url: filePath,
		layers: layers,
		parameters: {
			service: 'WMS',
			format: 'image/png',
			transparent: true,
			Width: 256,
			Height: 256,
			tiled: true,
		},
		enablePickFeatures: true,
	});
	var layer = viewer.imageryLayers.addImageryProvider(provider);
	return layer;
}
function addProjectLabel(viewer, projectName, projectValue, projectClass, projectPositionX, projectPositionY, percentageComplete) {
	var radius;
	if (projectValue >= 10000) {
		radius = 20000;
	} else if (projectValue <= 1000) {
		radius = 10000;
	} else {
		radius = 30000 * (projectValue / 10000);
	}
	var color;
	switch (projectClass) {
		case '交通':
			color = 'red';
			break;
		case '水利':
			color = 'green';
			break;
		case '安全生产':
			color = 'blue';
			break;
		default:
			color = '#FF7F24';
	}
	var tem = viewer.entities.add({
		name: projectName,
		position: Cesium.Cartesian3.fromDegrees(projectPositionX, projectPositionY, 0),
		ellipse: {
			semiMinorAxis: radius,
			semiMajorAxis: radius,
			material: getColorRamp(color, percentageComplete),
		},
		label: {
			text: percentageComplete.toFixed(2) * 100 + '%',
			font: '12px 黑体',
		},
	});
	var ohg = viewer.camera.positionCartographic.height;

	viewer.scene.camera.moveEnd.addEventListener(function () {
		var hg = viewer.camera.positionCartographic.height;
		tem.ellipse.semiMajorAxis = radius * (hg / ohg);
		tem.ellipse.semiMinorAxis = radius * (hg / ohg);
	});
}
function getColorRamp(color, percentageComplete) {
	var canvas = document.createElement('canvas');
	canvas.width = 400;
	canvas.height = 400;
	// var percentageComplete = 0.25;
	var ctx = canvas.getContext('2d');
	var startPoint = 1.5 * Math.PI;
	var grd = ctx.createRadialGradient(200, 200, 50, 200, 200, 200);
	grd.addColorStop(0, color);
	// grd.addColorStop(1, '#333');
	ctx.fillStyle = grd;
	ctx.beginPath();
	ctx.moveTo(200, 200);
	ctx.arc(200, 200, 200, startPoint, startPoint + Math.PI * 2 * percentageComplete, false);
	ctx.fill();
	ctx.stroke();

	var ctx2 = canvas.getContext('2d');
	var startPoint2 = 1.5 * Math.PI + Math.PI * 2 * percentageComplete;
	var grd2 = ctx2.createRadialGradient(200, 200, 50, 200, 200, 200);
	grd2.addColorStop(0, color);
	// grd2.addColorStop(1, '#333');
	ctx2.fillStyle = grd2;
	ctx2.beginPath();
	ctx2.moveTo(200, 200);
	ctx2.arc(200, 200, 200, startPoint2, startPoint2 + Math.PI * 2 * (1 - percentageComplete), false);
	ctx2.globalAlpha = 0.6;
	ctx2.fill();
	ctx2.stroke();

	return canvas;
}
/*展点
coordinates：站点的坐标内容，为字符串格式
name：添加的entity的name属性
*/
function drawPoint(coordinates) {
	var arr = coordinates.split('\n');
	for (var i = 0; i < arr.length; i++) {
		var arr2 = arr[i].split(',');
		viewer.entities.add({
			name: 'darwPoint',
			position: Cesium.Cartesian3.fromDegrees(arr2[1], arr2[2], arr2[3]),
			point: {
				pixelSize: 5,
				color: Cesium.Color.ORANGE,
			},
			label: {
				text: arr2[0],
				font: '12px 黑体',
				verticalOrigin: Cesium.VerticalOrigin.TOP,
				horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
				pixelOffset: new Cesium.Cartesian2(5, 5),
				fillColor: Cesium.Color.ORANGE,
			},
		});
	}
}
/*捕捉:带坐标提示功能
layername：为要捕捉的实体的name属性
newpoint：捕捉到的点为cartographic2
callback：回调函数
 */
function catchPoint(viewer, layername, callback, continuous, handlerIn) {
	var newpoint;
	var handler;
	if (Cesium.defined(handlerIn)) {
		handler = handlerIn;
	} else {
		var canvas = viewer.scene.canvas;
		/* var */ handler = new Cesium.ScreenSpaceEventHandler(canvas);
	}
	/*坐标提示*/
	// var canvas = viewer.scene.canvas;
	// /* var */ handler = new Cesium.ScreenSpaceEventHandler(canvas);
	var catchEntity;
	var coordinate;
	var cartographic;
	handler.setInputAction(showLabel, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
	/*点击获取坐标*/
	var coordinate2;
	var cartographic2;
	handler.setInputAction(returnPoint, Cesium.ScreenSpaceEventType.LEFT_CLICK);
	if (continuous == true) {
		handler.setInputAction(function () {
			viewer.entities.remove(viewer.entities.getById('pointLabel'));
			handler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE);
			handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
		}, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
	}
	function returnPoint(movement) {
		var pick = viewer.scene.pick(movement.position);
		if (pick == undefined || pick.id._name != layername) {
			var ellipsoid = viewer.scene.globe.ellipsoid;
			var cartesian = viewer.camera.pickEllipsoid(movement.position, ellipsoid);
			cartographic2 = viewer.scene.globe.ellipsoid.cartesianToCartographic(cartesian);
			newpoint = cartographic2;
			callback(newpoint);
			if (continuous == false) {
				viewer.entities.remove(viewer.entities.getById('pointLabel'));
				handler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE);
				handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
			}
			return;
		} else if (pick.id._name == layername) {
			coordinate2 = pick.id._position._value;
			cartographic2 = viewer.scene.globe.ellipsoid.cartesianToCartographic(coordinate);
			pick.id.point.color = Cesium.Color.RED;
			newpoint = cartographic2;
			callback(newpoint);
			if (continuous == false) {
				viewer.entities.remove(viewer.entities.getById('pointLabel'));
				handler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE);
				handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
			}
		}
	}
	function showLabel(movement) {
		try {
			catchEntity = viewer.entities.getById('pointLabel');
			viewer.entities.remove(catchEntity);
			catchEntity = undefined;
		} catch (err) {
			console.log(err);
		}
		var pick = viewer.scene.pick(movement.endPosition);
		if (pick == undefined) {
			var ellipsoid = viewer.scene.globe.ellipsoid;
			var cartesian = viewer.camera.pickEllipsoid(movement.endPosition, ellipsoid);
			if (cartesian) {
				cartographic = viewer.scene.globe.ellipsoid.cartesianToCartographic(cartesian);
				catchEntity = viewer.entities.add({
					id: 'pointLabel',
					position: cartesian,
					label: {
						text:
							'X:' +
							Cesium.Math.toDegrees(cartographic.longitude) /* .toFixed(2) */ +
							',Y:' +
							Cesium.Math.toDegrees(cartographic.latitude) /* .toFixed(2) */,
						font: '12px 黑体',
						verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
						horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
						pixelOffset: new Cesium.Cartesian2(25, 0),
						fillColor: Cesium.Color.BLACK,
						showBackground: true,
						backgroundColor: Cesium.Color.SILVER,
					},
				});
			}
			return;
		}
		var layerName = pick.id._name;
		if (layerName == layername) {
			coordinate = pick.id._position._value;
			cartographic = viewer.scene.globe.ellipsoid.cartesianToCartographic(coordinate);
			if (catchEntity == undefined) {
				catchEntity = viewer.entities.add({
					id: 'pointLabel',
					position: coordinate,
					label: {
						text:
							'X:' +
							Cesium.Math.toDegrees(cartographic.longitude) /* .toFixed(2) */ +
							',Y:' +
							Cesium.Math.toDegrees(cartographic.latitude) /* .toFixed(2) */,
						font: '12px 黑体',
						verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
						horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
						pixelOffset: new Cesium.Cartesian2(25, 0),
						fillColor: Cesium.Color.BLACK,
						showBackground: true,
						backgroundColor: Cesium.Color.INDIANRED,
					},
				});
			}
		}
	}
}
/*cesium初始化*/
function initViewer() {
	Cesium.Ion.defaultAccessToken =
		'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJlZDFlN2QyNi05NTMyLTRkZjMtYjM3Ni1iZTQzY2M1NGVhNjAiLCJpZCI6Mjg2NjUsInNjb3BlcyI6WyJhc3IiLCJnYyJdLCJpYXQiOjE1OTEzMjY3MDJ9.h-nWrkKCjr308Y1iOz28f26eogyP6ZPfgfo1pny_vl0';
	// var viewer;
	viewer = new Cesium.Viewer('cesiumdiv', {
		animation: false,
		baseLayerPicker: false,
		timeline: false,
		geocoder: false,
		navigationHelpButton: false,
		sceneModePicker: false,
		// homeButton: false,
		fullscreenButton: false,
		// vrButton: true,
		infoBox: true,
		// sceneMode: Cesium.SceneMode.SCENE2D,
	});
	viewer.imageryLayers.removeAll();
	viewer.scene.globe.baseColor = new Cesium.Color.fromCssColorString('#0a2e3c');
	viewer.scene.screenSpaceCameraController.maximumZoomDistance = 1850000;
	viewer.scene.screenSpaceCameraController.minimumZoomDistance = 10;

	var rect = new Cesium.Rectangle((110.2896 / 180) * 3.1415, (31.3748 / 180) * 3.1415, (117.0068 / 180) * 3.1415, (36.4526 / 180) * 3.1415);
	function defaultView() {
		viewer.camera.setView({
			destination: rect,
			orientation: {
				heading: Cesium.Math.toRadians(0),
				pitch: Cesium.Math.toRadians(-90),
				roll: 0.0,
			},
		});
	}
	defaultView();
	//重置homebutton
	Cesium.Camera.DEFAULT_VIEW_RECTANGLE = rect;
	var hpr = new Cesium.HeadingPitchRange(Cesium.Math.toRadians(0), Cesium.Math.toRadians(-90), 0);
	Cesium.Camera.DEFAULT_OFFSET = hpr;
	Cesium.Camera.DEFAULT_VIEW_FACTOR = 0;
	//禁用旋转
	var scene = viewer.scene;
	scene.screenSpaceCameraController.enableRotate = true;
	viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
	scene.screenSpaceCameraController.enableTilt = false;
	// <!-- 经纬度实时显示 -->
	var longitude_show = document.getElementById('longitude_show');
	var latitude_show = document.getElementById('latitude_show');
	var altitude_show = document.getElementById('altitude_show');
	var canvas = viewer.scene.canvas;
	//具体事件的实现
	var ellipsoid = viewer.scene.globe.ellipsoid;
	var handler = new Cesium.ScreenSpaceEventHandler(canvas);
	handler.setInputAction(function (movement) {
		var cartesian = viewer.camera.pickEllipsoid(movement.endPosition, ellipsoid);
		if (cartesian) {
			var cartographic = viewer.scene.globe.ellipsoid.cartesianToCartographic(cartesian);
			var lat_String = Cesium.Math.toDegrees(cartographic.latitude).toFixed(4);
			var log_String = Cesium.Math.toDegrees(cartographic.longitude).toFixed(4);
			var alti_String = (viewer.camera.positionCartographic.height / 1000).toFixed(2);
			longitude_show.innerHTML = log_String;
			latitude_show.innerHTML = lat_String;
			altitude_show.innerHTML = alti_String;
		}
	}, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
	// addGeoServer(viewer, 'http://127.0.0.1:8008/geoserver/dxm/wms', 'dxm:xzq_sheng');
	// addGeoServer(viewer, 'http://127.0.0.1:8008/geoserver/dxm/wms', 'dxm:xzq_xian');
	// addGeoServer(viewer, 'http://127.0.0.1:8008/geoserver/dxm/wms', 'dxm:xzq_shi');
	// addGeoServer(viewer, 'http://127.0.0.1:8008/geoserver/dxm/wms', 'dxm:waterandriver');
	// addGeoServer(viewer, 'http://127.0.0.1:8008/geoserver/dxm/wms', 'dxm:roads_line');
	// addGeoServer(viewer, 'http://127.0.0.1:8008/geoserver/dxm/wms', 'dxm:railways_line');
	// addGeoServer(viewer, 'http://127.0.0.1:8008/geoserver/dxm/wms', 'dxm:landuse');
	// addGeoServer(viewer, 'http://127.0.0.1:8008/geoserver/dxm/wms', 'dxm:buidings');
	// addGeoServer(viewer, 'http://127.0.0.1:8008/geoserver/dxm/wms', 'dxm:traffic');
	// addGeoServer(viewer, 'http://127.0.0.1:8008/geoserver/dxm/wms', 'dxm:transport');
	// addGeoServer(viewer, 'http://127.0.0.1:8008/geoserver/dxm/wms', 'dxm:places_point');
	addGeoServer(viewer, 'http://127.0.0.1:8008/geoserver/dxm/wms', 'dxm:dxm_polygon');
	addGeoServer(viewer, 'http://127.0.0.1:8008/geoserver/dxm/wms', 'dxm:dxm_line');
	addGeoServer(viewer, 'http://127.0.0.1:8008/geoserver/dxm/wms', 'dxm:dxm_point');

	/*添加市级统计信息label*/
	// addHtmlLabelBylayer(
	// 	viewer,
	// 	'http://localhost:8008/geoserver/dxm/wfs',
	// 	'xzq_shi',
	// 	'	<div class="container" style="background-color: rgba(255, 255, 255, 0.5); width: 120px; padding: 0;">待明确需求</div>',
	// 	900,
	// 	250
	// );
	/*添加市级状态高亮显示*/
	// var stutusJson = {
	// 	410100: Cesium.Color.RED.withAlpha(0.5),
	// 	410200: Cesium.Color.RED.withAlpha(0.5),
	// 	410300: Cesium.Color.RED.withAlpha(0.5),
	// 	410400: Cesium.Color.RED.withAlpha(0.5),
	// 	410500: Cesium.Color.YELLOW.withAlpha(0.5),
	// 	410600: Cesium.Color.GREEN.withAlpha(0.5),
	// 	410700: Cesium.Color.YELLOW.withAlpha(0.5),
	// 	410800: Cesium.Color.GREEN.withAlpha(0.5),
	// 	410900: Cesium.Color.YELLOW.withAlpha(0.5),
	// 	411000: Cesium.Color.GREEN.withAlpha(0.5),
	// 	411100: Cesium.Color.GREEN.withAlpha(0.5),
	// 	411200: Cesium.Color.GREEN.withAlpha(0.5),
	// 	411300: Cesium.Color.GREEN.withAlpha(0.5),
	// 	411400: Cesium.Color.YELLOW.withAlpha(0.5),
	// 	411500: Cesium.Color.GREEN.withAlpha(0.5),
	// 	411600: Cesium.Color.YELLOW.withAlpha(0.5),
	// 	411700: Cesium.Color.GREEN.withAlpha(0.5),
	// 	419001: Cesium.Color.GREEN.withAlpha(0.5),
	// };
	// highLightBylayer(viewer, 'http://localhost:8008/geoserver/dxm/wfs', 'dxm:xzq_shi', 'XZQCODE', stutusJson, 2500, 400);
	return viewer;
}
/*对图层进行分类高亮显示，并可以根据航高对高亮显示进行控制，实现点击缩放功能。
url:wfs地址
layerName:图层名称
keyField：图层的使用字段。
stutusJson：图层内个对象的状态值，主要用于显示状态的控制，为json,如下：
	var stutusJson = {
		410100: Cesium.Color.RED.withAlpha(0.5),
		410200: Cesium.Color.RED.withAlpha(0.5),
		410300: Cesium.Color.RED.withAlpha(0.5),
		410400: Cesium.Color.RED.withAlpha(0.5),
		410500: Cesium.Color.YELLOW.withAlpha(0.5),
		410600: Cesium.Color.YELLOW.withAlpha(0.5),
		410700: Cesium.Color.YELLOW.withAlpha(0.5),
		410800: Cesium.Color.YELLOW.withAlpha(0.5),
		410900: Cesium.Color.YELLOW.withAlpha(0.5),
		411000: Cesium.Color.GREEN.withAlpha(0.5),
		411100: Cesium.Color.GREEN.withAlpha(0.5),
		411200: Cesium.Color.GREEN.withAlpha(0.5),
		411300: Cesium.Color.GREEN.withAlpha(0.5),
		411400: Cesium.Color.GREEN.withAlpha(0.5),
		411500: Cesium.Color.GREEN.withAlpha(0.5),
		411600: Cesium.Color.GREEN.withAlpha(0.5),
		411700: Cesium.Color.GREEN.withAlpha(0.5),
		419001: Cesium.Color.GREEN.withAlpha(0.5),
  };
  maxHeight, minHeight：最大航高和最小航高，用于图层的显示控制
*/
function highLightBylayer(viewer, url, layerName, keyField, stutusJson, maxHeight, minHeight) {
	$.get(
		url,
		{
			request: 'GetFeature',
			version: '1.1.0',
			typename: layerName,
			outputformat: 'json',
		},
		function (date) {
			if (date.features.length == 0) {
				return;
			}
			for (var j = 0; j < date.features.length; j++) {
				var coordinates = date.features[j].geometry.coordinates[0][0];
				var arr = [];
				var minX = 180;
				var maxX = 0;
				var minY = 90;
				var maxY = 0;

				for (var i = 0; i < coordinates.length; i++) {
					arr = arr.concat(coordinates[i]);
					if (coordinates[i][0] > maxX) {
						maxX = coordinates[i][0];
					}
					if (coordinates[i][0] < minX) {
						minX = coordinates[i][0];
					}
					if (coordinates[i][1] > maxY) {
						maxY = coordinates[i][1];
					}
					if (coordinates[i][1] < minY) {
						minY = coordinates[i][1];
					}
				}
				try {
					var temColor;
					if (Cesium.defined(stutusJson[date.features[j].properties[keyField]])) {
						temColor = stutusJson[date.features[j].properties[keyField]];
					} else {
						temColor = Cesium.Color.BLACK.withAlpha(0.5);
					}
					var entity = viewer.entities.add({
						id: date.features[j].id,
						name: 'highLightBylayer',
						polygon: {
							hierarchy: Cesium.Cartesian3.fromDegreesArray(arr),
							material: temColor,
							closeTop: false,
							closeBottom: false,
						},
					});
				} catch (err) {}
				entityShowByHeight(viewer, entity, maxHeight, minHeight);
				entity.minX = minX;
				entity.minY = minY;
				entity.maxX = maxX;
				entity.maxY = maxY;
				var canvas = viewer.scene.canvas;
				var handler = new Cesium.ScreenSpaceEventHandler(canvas);
				handler.setInputAction(function (movement) {
					var obj = viewer.scene.pick(movement.position);
					if (Cesium.defined(obj) && obj.id.name == 'highLightBylayer') {
						viewer.camera.flyTo({
							destination: Cesium.Rectangle.fromDegrees(obj.id.minX, obj.id.minY, obj.id.maxX, obj.id.maxY),
						});
					}
				}, Cesium.ScreenSpaceEventType.LEFT_CLICK);
			}
		}
	);
}
/*根据航高设置实体对象的显隐
entity:实体对象
maxHeight:最大航高
minHeight:最小航高
*/
function entityShowByHeight(viewer, entity, maxHeight, minHeight) {
	viewer.scene.camera.moveEnd.addEventListener(function () {
		var alti = viewer.camera.positionCartographic.height / 1000;
		if (alti > maxHeight) {
			entity.show = false;
		} else if (alti < minHeight) {
			entity.show = false;
		} else {
			entity.show = true;
		}
	});
}
/*刷新图层*/
function refreshLayer(viewer, url, layername) {
	if (viewer.imageryLayers._layers.length > 0) {
		for (var i = 0; i < viewer.imageryLayers._layers.length; i++) {
			if (viewer.imageryLayers._layers[i]._imageryProvider._layers == layername) {
				viewer.imageryLayers.remove(viewer.imageryLayers._layers[i]);
				addGeoServer(viewer, url, layername);
			}
		}
	}
}
/*用于返回小图层名：dxm:dxm_point------>dxm_point*/
function returnSmallLayername(bigLayername) {
	var tem = [];
	tem = bigLayername.split(':');
	if (tem.length > 1) {
		return tem[1];
	} else {
		return bigLayername;
	}
}
/*点击获取属性信息
callback(data)回调函数，data为查询倒的信息properties
*/
function clickForProperties2(viewer, url, layername, callback) {
	var canvas = viewer.scene.canvas;
	var handler = new Cesium.ScreenSpaceEventHandler(canvas);
	var labelText;
	handler.setInputAction(function (movement) {
		var ellipsoid = viewer.scene.globe.ellipsoid;
		var cartesian = viewer.camera.pickEllipsoid(movement.endPosition, ellipsoid);
		var updateLabel = viewer.entities.getById('clickForProperty');
		labelText = '请选择对象';
		if (Cesium.defined(updateLabel)) {
			viewer.entities.remove(updateLabel);
			viewer.entities.add({
				id: 'clickForProperty',
				position: cartesian,
				label: {
					text: labelText,
					font: '12px 黑体',
					verticalOrigin: Cesium.VerticalOrigin.TOP,
					horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
					pixelOffset: new Cesium.Cartesian2(5, -15),
					fillColor: Cesium.Color.BLACK,
					showBackground: true,
					backgroundColor: Cesium.Color.SILVER,
				},
			});
		} else {
			viewer.entities.add({
				id: 'clickForProperty',
				position: cartesian,
				label: {
					text: labelText,
					font: '12px 黑体',
					verticalOrigin: Cesium.VerticalOrigin.TOP,
					horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
					pixelOffset: new Cesium.Cartesian2(5, -15),
					fillColor: Cesium.Color.BLACK,
					showBackground: true,
					backgroundColor: Cesium.Color.SILVER,
				},
			});
		}
	}, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
	handler.setInputAction(function (movement) {
		var pickRay = viewer.camera.getPickRay(movement.position);
		var featuresPromise = viewer.imageryLayers.pickImageryLayerFeatures(pickRay, viewer.scene);
		if (!Cesium.defined(featuresPromise)) {
			console.log('No features picked.');
		} else {
			Cesium.when(featuresPromise, function (features) {
				if (features.length > 0) {
					if (features[0].imageryLayer._imageryProvider._layers == layername) {
						var updateLabel = viewer.entities.getById('clickForProperty');
						if (Cesium.defined(updateLabel)) {
							viewer.entities.remove(updateLabel);
						}
						var filter = '<Filter>' + '<GmlObjectId id="' + features[0].data.id + '"/>' + '</Filter>';
						$.get(
							url,
							{
								request: 'GetFeature',
								version: '1.1.0',
								typename: returnSmallLayername(layername),
								outputformat: 'json',
								FILTER: filter,
							},
							function (data) {
								viewer.entities.remove(updateLabel);
								callback(data.features[0].properties);
								handler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE);
								handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
							}
						);
					}
				}
			});
		}
	}, Cesium.ScreenSpaceEventType.LEFT_CLICK);
}
/*点击获取属性信息
调用了clickForID、getPropertiesByID方法
callback(ID,data)回调函数，data为查询倒的信息properties,查询倒的信息ID
*/
function clickForProperties(viewer, url, layername, callback) {
	clickForID(viewer, url, layername, function (ID) {
		getPropertiesByID(url, layername, ID, function (data) {
			callback(ID, data);
		});
	});
}
/*根据ID获取属性信息
callback(data)回调函数，data为查询倒的信息properties
*/
function getPropertiesByID(url, layername, id, callback) {
	$.ajax({
		type: 'GET',
		url: url,
		data: {
			cql_filter: "ID = '" + id + "'",
			request: 'GetFeature',
			version: '1.1.0',
			typename: layername,
			outputformat: 'json',
		},
		contentType: 'text/plain;charset=UTF-8',
		success: function (data) {
			if (data.features.length > 1) {
				console.log('矢量数据中存在ID值重复');
				console.log(data);
			}
			if (data.features.length == 1) {
				delete data.features[0].properties['ID'];
				callback(data.features[0].properties);
			}
			if (data.features.length == 0) {
				console.log('查询失败');
			}
		},
		error: function (err) {
			console.log(err);
		},
	});
}
function getFeatureByID(url, layername, id, callback) {
	$.ajax({
		type: 'GET',
		url: url,
		data: {
			cql_filter: "ID = '" + id + "'",
			request: 'GetFeature',
			version: '1.1.0',
			typename: layername,
			outputformat: 'json',
		},
		contentType: 'text/plain;charset=UTF-8',
		success: function (data) {
			if (data.features.length > 1) {
				console.log('矢量数据中存在ID值重复');
				// console.log(data);
			}
			if (data.features.length == 1) {
				// delete data.features[0].properties['ID'];
				callback(data.features[0]);
			}
			if (data.features.length == 0) {
				console.log('查询失败');
			}
		},
		error: function (err) {
			console.log(err);
		},
	});
}
/*根据ID设置属性信息，本方法为单个字段设置
id:矢量图层ID图层对应的值
fieldName：更新的字段名称
fieldValue：更新的字段值
*/
function setPropertyByID(viewer, url, layername, id, fieldName, fieldValue) {
	if (fieldName == 'ID') {
		return;
	}
	var header =
		'<?xml version="1.0" ?> ' +
		'<wfs:Transaction ' +
		'version="1.1.0" ' +
		'service="WFS" ' +
		'xmlns="http://www.someserver.com/myns" ' +
		'xmlns:ogc="http://www.opengis.net/ogc" ' +
		'xmlns:wfs="http://www.opengis.net/wfs" ' +
		'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ' +
		'xsi:schemaLocation="http://www.opengis.net/wfs ../wfs/1.1.0/WFS.xsd"> ';
	var body =
		'<wfs:Update typeName="' +
		returnSmallLayername(layername) +
		'"> ' +
		'<wfs:Property> ' +
		'<wfs:Name>' +
		fieldName +
		'</wfs:Name> ' +
		'<wfs:Value>' +
		fieldValue +
		'</wfs:Value> ' +
		'</wfs:Property> ';
	var filter =
		'<ogc:Filter> ' +
		'<ogc:PropertyIsEqualTo>' +
		'<ogc:PropertyName>ID</ogc:PropertyName> ' +
		'<ogc:Literal>' +
		id +
		'</ogc:Literal> ' +
		'</ogc:PropertyIsEqualTo> ' +
		'</ogc:Filter> ' +
		'</wfs:Update> ' +
		'</wfs:Transaction> ';
	var xml = header + body + filter;
	$.ajax({
		type: 'POST',
		url: url,
		data: xml,
		contentType: 'text/plain;charset=UTF-8',
		success: function (data) {
			refreshLayer(viewer, url, layername);
			// console.log(data);
		},
		error: function (err) {
			console.log('ceshi');
			console.log(err);
		},
	});
}
/*点击获取对象的ID
callback(data)回调函数，data为查询倒的信息ID
*/
function clickForID(viewer, url, layername, callback) {
	var canvas = viewer.scene.canvas;
	var handler = new Cesium.ScreenSpaceEventHandler(canvas);
	var labelText;
	handler.setInputAction(function (movement) {
		var ellipsoid = viewer.scene.globe.ellipsoid;
		var cartesian = viewer.camera.pickEllipsoid(movement.endPosition, ellipsoid);
		var updateLabel = viewer.entities.getById('clickForProperty');
		labelText = '请选择对象';
		if (Cesium.defined(updateLabel)) {
			viewer.entities.remove(updateLabel);
			viewer.entities.add({
				id: 'clickForProperty',
				position: cartesian,
				label: {
					text: labelText,
					font: '12px 黑体',
					verticalOrigin: Cesium.VerticalOrigin.TOP,
					horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
					pixelOffset: new Cesium.Cartesian2(5, -15),
					fillColor: Cesium.Color.BLACK,
					showBackground: true,
					backgroundColor: Cesium.Color.SILVER,
				},
			});
		} else {
			viewer.entities.add({
				id: 'clickForProperty',
				position: cartesian,
				label: {
					text: labelText,
					font: '12px 黑体',
					verticalOrigin: Cesium.VerticalOrigin.TOP,
					horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
					pixelOffset: new Cesium.Cartesian2(5, -15),
					fillColor: Cesium.Color.BLACK,
					showBackground: true,
					backgroundColor: Cesium.Color.SILVER,
				},
			});
		}
	}, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
	handler.setInputAction(function (movement) {
		var pickRay = viewer.camera.getPickRay(movement.position);
		var featuresPromise = viewer.imageryLayers.pickImageryLayerFeatures(pickRay, viewer.scene);
		if (!Cesium.defined(featuresPromise)) {
			console.log('No features picked.');
		} else {
			Cesium.when(featuresPromise, function (features) {
				if (features.length > 0) {
					if (features[0].imageryLayer._imageryProvider._layers == layername) {
						var updateLabel = viewer.entities.getById('clickForProperty');
						if (Cesium.defined(updateLabel)) {
							viewer.entities.remove(updateLabel);
						}
						var filter = '<Filter>' + '<GmlObjectId id="' + features[0].data.id + '"/>' + '</Filter>';
						$.get(
							url,
							{
								request: 'GetFeature',
								version: '1.1.0',
								typename: returnSmallLayername(layername),
								outputformat: 'json',
								FILTER: filter,
							},
							function (data) {
								viewer.entities.remove(updateLabel);
								callback(data.features[0].properties.ID);
								handler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE);
								handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
							}
						);
					}
				}
			});
		}
	}, Cesium.ScreenSpaceEventType.LEFT_CLICK);
	handler.setInputAction(function () {
		handler.destroy();
		if (Cesium.defined(viewer.entities.getById('clickForProperty'))) {
			viewer.entities.remove(viewer.entities.getById('clickForProperty'));
		}
	}, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
}
/*在线编辑多段线
本方法引用了addLabelByMove、catchPoint、refreshLayer方法
ctrl+左键双击对象，开始编辑。
shift+左键双击对象，结束编辑。
ctrl+左键双击点号，移动点位。
alt+左键双击点号，移除点位。
alt+左键单击多段线，添加点位。
右键单击，退出当前操作
*/
function editPLOnline(viewer, url, layername) {
	var canvas = viewer.scene.canvas;
	var handler = new Cesium.ScreenSpaceEventHandler(canvas);
	var selectObjPrompthandler = new Cesium.ScreenSpaceEventHandler(canvas);
	var catchHandler = new Cesium.ScreenSpaceEventHandler(canvas);
	addLabelByMove(selectObjPrompthandler, 'CTRL+双击选择编辑对象', 'selectObjPrompt');
	var coordinates;
	var coordinatesJson = {};
	var entity;
	var featureSel;
	handler.setInputAction(
		function (movement) {
			var pickRay = viewer.camera.getPickRay(movement.position);
			var featuresPromise = viewer.imageryLayers.pickImageryLayerFeatures(pickRay, viewer.scene);
			if (!Cesium.defined(featuresPromise)) {
				console.log('No features picked.');
			} else {
				Cesium.when(featuresPromise, function (features) {
					if (features.length > 0) {
						for (var i = 0; i < features.length; i++) {
							if (features[i].imageryLayer._imageryProvider._layers == layername) {
								viewer.entities.remove(viewer.entities.getById('selectObjPrompt'));
								selectObjPrompthandler.destroy();
								featureSel = features[i];
								coordinates = features[i].data.geometry.coordinates;
								for (var j = 0; j < coordinates.length; j++) {
									coordinatesJson[j] = {};
									for (var k = 0; k < coordinates[j].length; k++) {
										coordinatesJson[j][k] = coordinates[j][k];
										viewer.entities.add({
											id: j + '-' + k,
											name: 'editPLOnline',
											position: Cesium.Cartesian3.fromDegrees(coordinates[j][k][0], coordinates[j][k][1], 0),
											point: {
												pixelSize: 5,
												color: Cesium.Color.ORANGE,
											},
											label: {
												text: j + '-' + k,
												font: '12px 黑体',
												verticalOrigin: Cesium.VerticalOrigin.TOP,
												horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
												pixelOffset: new Cesium.Cartesian2(-55, -15),
												fillColor: Cesium.Color.BLACK,
												showBackground: true,
												backgroundColor: Cesium.Color.SILVER,
											},
										});
									}
								}
								break;
							}
						}
					}
				});
			}
			/*  ------------------- */
			var feature = viewer.scene.pick(movement.position);
			try {
				if (feature.id instanceof Cesium.Entity || feature.id._name == 'editPLOnline') {
					var temHandler = new Cesium.ScreenSpaceEventHandler(canvas);
					catchHandler = temHandler;
					//判断之前选择entity颜色是否还原
					if (Cesium.defined(entity)) {
						entity._label.backgroundColor = Cesium.Color.SILVER;
						entity._point.color = Cesium.Color.ORANGE;
					}
					//对当前选择entity进行着色
					entity = feature.id;
					entity._label.backgroundColor = Cesium.Color.RED;
					entity._point.color = Cesium.Color.RED;
					catchPoint(
						viewer,
						'darwPoint',
						function (newpoint) {
							var idSplit = entity.id.split('-');
							entity.position = Cesium.Cartesian3.fromRadians(newpoint.longitude, newpoint.latitude, newpoint.height);
							coordinatesJson[idSplit[0]][idSplit[1]] = [
								Cesium.Math.toDegrees(newpoint.longitude),
								Cesium.Math.toDegrees(newpoint.latitude),
							];
							var header =
								'<?xml version="1.0" ?>' +
								'<wfs:Transaction ' +
								'version="1.1.0" ' +
								'service="WFS" ' +
								'xmlns="http://www.someserver.com/myns" ' +
								'xmlns:gml="http://www.opengis.net/gml" ' +
								'xmlns:ogc="http://www.opengis.net/ogc" ' +
								'xmlns:wfs="http://www.opengis.net/wfs" ' +
								'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ' +
								'xsi:schemaLocation="http://www.opengis.net/wfs ../wfs/1.1.0/WFS.xsd"> ' +
								'<wfs:Update typeName="' +
								layername +
								'"> ';
							var geo =
								/*  '<the_geom> ' +  */ '<wfs:Property> <wfs:Name>the_geom</wfs:Name> <wfs:Value> ' +
								'<gml:MultiLineString srsname="EPSG_4326">';
							// var newCoordinates = [];
							var i = 0;
							for (var p in coordinatesJson) {
								geo = geo + '<gml:lineStringMember>' + '<gml:LineString>';
								// newCoordinates.push([]);
								var j = 0;
								var len = getJsonLength(coordinatesJson[p]);
								while (j < len) {
									// newCoordinates[i].push(coordinatesJson[p][j]);
									geo = geo + '<gml:coord><X>' + coordinatesJson[p][j][1] + '</X><Y>' + coordinatesJson[p][j][0] + '</Y></gml:coord>';
									j++;
								}
								i++;
								geo = geo + '</gml:LineString>' + '</gml:lineStringMember>';
							}
							geo = geo + '</gml:MultiLineString> </wfs:Value> </wfs:Property> ' /* + '</the_geom> ' */;
							var filter = '<ogc:Filter> ' + '<ogc:GmlObjectId id="' + featureSel.data.id + '"/> ' + '</ogc:Filter> ';
							var footer = '</wfs:Update> ' + '</wfs:Transaction> ';
							var xml = header + geo + filter + footer;
							$.ajax({
								type: 'POST',
								url: url,
								data: xml,
								contentType: 'text/plain;charset=UTF-8',
								success: function (data) {
									// console.log(data);
									refreshLayer(viewer, url, layername);
								},
								error: function (err) {
									console.log(err);
								},
							});
						},
						false,
						catchHandler
					);
				}
			} catch (err) {
				console.log(err);
			}
		},
		Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK,
		Cesium.KeyboardEventModifier.CTRL
	);
	//ALT+MOVE坐标提示
	handler.setInputAction(
		function (movement) {
			try {
				catchEntity = viewer.entities.getById('pointLabel');
				viewer.entities.remove(catchEntity);
				catchEntity = undefined;
			} catch (err) {
				console.log(err);
			}
			var pick = viewer.scene.pick(movement.endPosition);
			if (pick == undefined) {
				var ellipsoid = viewer.scene.globe.ellipsoid;
				var cartesian = viewer.camera.pickEllipsoid(movement.endPosition, ellipsoid);
				if (cartesian) {
					cartographic = viewer.scene.globe.ellipsoid.cartesianToCartographic(cartesian);
					catchEntity = viewer.entities.add({
						id: 'pointLabel',
						position: cartesian,
						label: {
							text:
								'X:' +
								Cesium.Math.toDegrees(cartographic.longitude) /* .toFixed(2) */ +
								',Y:' +
								Cesium.Math.toDegrees(cartographic.latitude) /* .toFixed(2) */,
							font: '12px 黑体',
							verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
							horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
							pixelOffset: new Cesium.Cartesian2(25, 0),
							fillColor: Cesium.Color.BLACK,
							showBackground: true,
							backgroundColor: Cesium.Color.SILVER,
						},
					});
				}
				return;
			}
			var layerName = pick.id._name;
			if (layerName == 'darwPoint') {
				coordinate = pick.id._position._value;
				cartographic = viewer.scene.globe.ellipsoid.cartesianToCartographic(coordinate);
				if (catchEntity == undefined) {
					catchEntity = viewer.entities.add({
						id: 'pointLabel',
						position: coordinate,
						label: {
							text:
								'X:' +
								Cesium.Math.toDegrees(cartographic.longitude) /* .toFixed(2) */ +
								',Y:' +
								Cesium.Math.toDegrees(cartographic.latitude) /* .toFixed(2) */,
							font: '12px 黑体',
							verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
							horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
							pixelOffset: new Cesium.Cartesian2(25, 0),
							fillColor: Cesium.Color.BLACK,
							showBackground: true,
							backgroundColor: Cesium.Color.INDIANRED,
						},
					});
				}
			}
		},
		Cesium.ScreenSpaceEventType.MOUSE_MOVE,
		Cesium.KeyboardEventModifier.ALT
	);
	//清除坐标提示标记
	handler.setInputAction(function () {
		if (Cesium.defined(viewer.entities.getById('pointLabel'))) {
			viewer.entities.remove(viewer.entities.getById('pointLabel'));
		}
	}, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
	//ALT+左键单击，添加点
	handler.setInputAction(
		function (movement) {
			var pickRay = viewer.camera.getPickRay(movement.position);
			var featuresPromise = viewer.imageryLayers.pickImageryLayerFeatures(pickRay, viewer.scene);
			if (!Cesium.defined(featuresPromise)) {
				console.log('No features picked.');
			} else {
				Cesium.when(featuresPromise, function (features) {
					if (features.length > 0) {
						for (var i = 0; i < features.length; i++) {
							if (features[i].imageryLayer._imageryProvider._layers == layername) {
								var cartesian = viewer.camera.pickEllipsoid(movement.position, viewer.scene.globe.ellipsoid);
								var cartographic = Cesium.Cartographic.fromCartesian(cartesian);
								var coordAdded = [Cesium.Math.toDegrees(cartographic.longitude), Cesium.Math.toDegrees(cartographic.latitude)];
								// console.log(coordinatesJson);
								// console.log(coordAdded);
								increaseCoordinatesJson(coordinatesJson, coordAdded);
								//清除点号标记
								var i = 0;
								var j = 0;
								while (Cesium.defined(viewer.entities.getById(i + '-' + j))) {
									viewer.entities.remove(viewer.entities.getById(i + '-' + j));
									if (!Cesium.defined(viewer.entities.getById(i + '-' + (j + 1)))) {
										i++;
										j = 0;
									} else {
										j++;
									}
								}
								//更新远端
								var header =
									'<?xml version="1.0" ?>' +
									'<wfs:Transaction ' +
									'version="1.1.0" ' +
									'service="WFS" ' +
									'xmlns="http://www.someserver.com/myns" ' +
									'xmlns:gml="http://www.opengis.net/gml" ' +
									'xmlns:ogc="http://www.opengis.net/ogc" ' +
									'xmlns:wfs="http://www.opengis.net/wfs" ' +
									'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ' +
									'xsi:schemaLocation="http://www.opengis.net/wfs ../wfs/1.1.0/WFS.xsd"> ' +
									'<wfs:Update typeName="' +
									layername +
									'"> ';
								var geo =
									/*  '<the_geom> ' +  */ '<wfs:Property> <wfs:Name>the_geom</wfs:Name> <wfs:Value> ' +
									'<gml:MultiLineString srsname="EPSG_4326">';
								// var newCoordinates = [];
								var i = 0;
								for (var p in coordinatesJson) {
									geo = geo + '<gml:lineStringMember>' + '<gml:LineString>';
									// newCoordinates.push([]);
									var j = 0;
									var len = getJsonLength(coordinatesJson[p]);
									while (j < len) {
										// newCoordinates[i].push(coordinatesJson[p][j]);
										geo = geo + '<gml:coord><X>' + coordinatesJson[p][j][1] + '</X><Y>' + coordinatesJson[p][j][0] + '</Y></gml:coord>';
										j++;
									}
									i++;
									geo = geo + '</gml:LineString>' + '</gml:lineStringMember>';
								}
								geo = geo + '</gml:MultiLineString> </wfs:Value> </wfs:Property> ' /* + '</the_geom> ' */;
								var filter = '<ogc:Filter> ' + '<ogc:GmlObjectId id="' + featureSel.data.id + '"/> ' + '</ogc:Filter> ';
								var footer = '</wfs:Update> ' + '</wfs:Transaction> ';
								var xml = header + geo + filter + footer;
								$.ajax({
									type: 'POST',
									url: url,
									data: xml,
									contentType: 'text/plain;charset=UTF-8',
									success: function (data) {
										//清除点号标记
										var i = 0;
										var j = 0;
										while (Cesium.defined(viewer.entities.getById(i + '-' + j))) {
											viewer.entities.remove(viewer.entities.getById(i + '-' + j));
											if (!Cesium.defined(viewer.entities.getById(i + '-' + (j + 1)))) {
												i++;
												j = 0;
											} else {
												j++;
											}
										}
										//重新展绘坐标
										drawPointByCoordinatesJson(coordinatesJson);
										//刷新图层
										refreshLayer(viewer, url, layername);
									},
									error: function (err) {
										console.log(err);
									},
								});
							}
						}
					}
				});
			}
		},
		Cesium.ScreenSpaceEventType.LEFT_CLICK,
		Cesium.KeyboardEventModifier.ALT
	);
	//ALT+左键双击，移除点
	handler.setInputAction(
		function (movement) {
			var feature = viewer.scene.pick(movement.position);
			try {
				if (feature.id instanceof Cesium.Entity || feature.id._name == 'editPLOnline') {
					var temHandler = new Cesium.ScreenSpaceEventHandler(canvas);
					catchHandler = temHandler;
					entity = feature.id;
					entity._label.backgroundColor = Cesium.Color.RED;
					entity._point.color = Cesium.Color.RED;
					// console.log(coordinatesJson);
					reduceCoordinatesJson(coordinatesJson, entity.id);
					// console.log(coordinatesJson);
					var header =
						'<?xml version="1.0" ?>' +
						'<wfs:Transaction ' +
						'version="1.1.0" ' +
						'service="WFS" ' +
						'xmlns="http://www.someserver.com/myns" ' +
						'xmlns:gml="http://www.opengis.net/gml" ' +
						'xmlns:ogc="http://www.opengis.net/ogc" ' +
						'xmlns:wfs="http://www.opengis.net/wfs" ' +
						'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ' +
						'xsi:schemaLocation="http://www.opengis.net/wfs ../wfs/1.1.0/WFS.xsd"> ' +
						'<wfs:Update typeName="' +
						layername +
						'"> ';
					var geo =
						/*  '<the_geom> ' +  */ '<wfs:Property> <wfs:Name>the_geom</wfs:Name> <wfs:Value> ' +
						'<gml:MultiLineString srsname="EPSG_4326">';
					// var newCoordinates = [];
					var i = 0;
					for (var p in coordinatesJson) {
						geo = geo + '<gml:lineStringMember>' + '<gml:LineString>';
						// newCoordinates.push([]);
						var j = 0;
						var len = getJsonLength(coordinatesJson[p]);
						while (j < len) {
							// newCoordinates[i].push(coordinatesJson[p][j]);
							geo = geo + '<gml:coord><X>' + coordinatesJson[p][j][1] + '</X><Y>' + coordinatesJson[p][j][0] + '</Y></gml:coord>';
							j++;
						}
						i++;
						geo = geo + '</gml:LineString>' + '</gml:lineStringMember>';
					}
					geo = geo + '</gml:MultiLineString> </wfs:Value> </wfs:Property> ' /* + '</the_geom> ' */;
					var filter = '<ogc:Filter> ' + '<ogc:GmlObjectId id="' + featureSel.data.id + '"/> ' + '</ogc:Filter> ';
					var footer = '</wfs:Update> ' + '</wfs:Transaction> ';
					var xml = header + geo + filter + footer;
					$.ajax({
						type: 'POST',
						url: url,
						data: xml,
						contentType: 'text/plain;charset=UTF-8',
						success: function (data) {
							//清除点号标记
							var i = 0;
							var j = 0;
							while (Cesium.defined(viewer.entities.getById(i + '-' + j))) {
								viewer.entities.remove(viewer.entities.getById(i + '-' + j));
								if (!Cesium.defined(viewer.entities.getById(i + '-' + (j + 1)))) {
									i++;
									j = 0;
								} else {
									j++;
								}
							}
							//重新展绘坐标
							drawPointByCoordinatesJson(coordinatesJson);
							//刷新图层
							refreshLayer(viewer, url, layername);
						},
						error: function (err) {
							console.log(err);
						},
					});
				}
			} catch (err) {
				console.log(err);
			}
		},
		Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK,
		Cesium.KeyboardEventModifier.ALT
	);
	//SHIFT+左键双击结束当前多段线编辑,清除所有标记
	handler.setInputAction(
		function (movement) {
			//还原点号标注颜色
			if (Cesium.defined(entity)) {
				entity._label.backgroundColor = Cesium.Color.SILVER;
				entity._point.color = Cesium.Color.ORANGE;
				entity = undefined;
			}
			//终止catchpoint方法
			if (Cesium.defined(viewer.entities.getById('pointLabel'))) {
				viewer.entities.remove(viewer.entities.getById('pointLabel'));
        catchHandler.destroy();
        
			}
			//清除对象选择label

			if (Cesium.defined(viewer.entities.getById('selectObjPrompt'))) {
				viewer.entities.remove(viewer.entities.getById('selectObjPrompt'));
				selectObjPrompthandler.destroy();
			}
			//清除点号标记
			var i = 0;
			var j = 0;
			while (Cesium.defined(viewer.entities.getById(i + '-' + j))) {
				viewer.entities.remove(viewer.entities.getById(i + '-' + j));
				if (!Cesium.defined(viewer.entities.getById(i + '-' + (j + 1)))) {
					i++;
					j = 0;
				} else {
					j++;
				}
			}
			//终止事件
			handler.removeInputAction(Cesium.ScreenSpaceEventType.RIGHT_CLICK);
			handler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE);
			handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK, Cesium.KeyboardEventModifier.CTRL);
			handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK, Cesium.KeyboardEventModifier.ALT);
			handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK, Cesium.KeyboardEventModifier.ALT);
			handler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE, Cesium.KeyboardEventModifier.ALT);
			handler.destroy();
		},
		Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK,
		Cesium.KeyboardEventModifier.SHIFT
	);
	handler.setInputAction(function (movement) {
		//还原点号标注颜色
		if (Cesium.defined(entity)) {
			entity._label.backgroundColor = Cesium.Color.SILVER;
			entity._point.color = Cesium.Color.ORANGE;
			entity = undefined;
		}
		//终止catchpoint方法
		if (Cesium.defined(viewer.entities.getById('pointLabel'))) {
			viewer.entities.remove(viewer.entities.getById('pointLabel'));
			catchHandler.destroy();
		}
		//清除对象选择label,终止事件
		if (Cesium.defined(viewer.entities.getById('editPLOnline'))) {
			viewer.entities.remove(viewer.entities.getById('editPLOnline'));
			handler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE);
			handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
		}
	}, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
	//获取json的长度
	function getJsonLength(json) {
		var jsonLength = 0;
		for (var i in json) {
			jsonLength++;
		}
		return jsonLength;
	}
	//增加CoordinatesJson的点位
	function increaseCoordinatesJson(coordinatesJson, coordAdded) {
		var len = getJsonLength(coordinatesJson);
		for (var j = 0; j < len; j++) {
			var len2 = getJsonLength(coordinatesJson[j]);
			for (var k = 0; k < len2 - 1; k++) {
				if (
					Math.abs(
						(coordinatesJson[j][k][0] - coordinatesJson[j][k + 1][0]) / (coordinatesJson[j][k][1] - coordinatesJson[j][k + 1][1]) -
							(coordinatesJson[j][k][0] - coordAdded[0]) / (coordinatesJson[j][k][1] - coordAdded[1])
					) < 0.005 &&
					((coordinatesJson[j][k][0] < coordAdded[0] && coordinatesJson[j][k + 1][0] > coordAdded[0]) ||
						(coordinatesJson[j][k][0] > coordAdded[0] && coordinatesJson[j][k + 1][0] < coordAdded[0]))
				) {
					// console.log('ceshi ');
					coordinatesJson[j][len2] = [0, 0];
					for (var l = len2; l > k + 1; l--) {
						coordinatesJson[j][l] = coordinatesJson[j][l - 1];
					}
					coordinatesJson[j][k + 1] = coordAdded;
					break;
				}
			}
		}
	}
	//减少CoordinatesJson的点位
	function reduceCoordinatesJson(coordinatesJson, key) {
		var arr = key.split('-');
		var i = arr[0];
		var j = arr[1];
		var len = getJsonLength(coordinatesJson[i]);
		if (len == 2) {
			var len2 = getJsonLength(coordinatesJson);
			//删除图形库对应记录
			if (len2 == 1) {
				coordinatesJson = {};
			}
			//移除坐标集合，并重新排序
			if (len2 > 1) {
				for (var k = parseInt(i); k < len2; k++) {
					if (k == len2 - 1) {
						delete coordinatesJson[k];
					} else {
						coordinatesJson[k] = coordinatesJson[k + 1];
					}
				}
			}
			return;
		}
		for (var k = parseInt(j); k < len; k++) {
			if (k == len - 1) {
				delete coordinatesJson[i][k];
			} else {
				coordinatesJson[i][k] = coordinatesJson[i][k + 1];
			}
		}
	}
	//展绘CoordinatesJson的点位
	function drawPointByCoordinatesJson(coordinatesJson) {
		var len = getJsonLength(coordinatesJson);
		for (var j = 0; j < len; j++) {
			// coordinatesJson[j] = {};
			var len2 = getJsonLength(coordinatesJson[j]);
			for (var k = 0; k < len2; k++) {
				// coordinatesJson[j][k] = coordinates[j][k];
				viewer.entities.add({
					id: j + '-' + k,
					name: 'editPLOnline',
					position: Cesium.Cartesian3.fromDegrees(coordinatesJson[j][k][0], coordinatesJson[j][k][1], 0),
					point: {
						pixelSize: 5,
						color: Cesium.Color.ORANGE,
					},
					label: {
						text: j + '-' + k,
						font: '12px 黑体',
						verticalOrigin: Cesium.VerticalOrigin.TOP,
						horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
						pixelOffset: new Cesium.Cartesian2(-55, -15),
						fillColor: Cesium.Color.BLACK,
						showBackground: true,
						backgroundColor: Cesium.Color.SILVER,
					},
				});
			}
		}
	}
}
function addLabelByMove(handler, labelText, labelID) {
	handler.setInputAction(function (movement) {
		var ellipsoid = viewer.scene.globe.ellipsoid;
		var cartesian = viewer.camera.pickEllipsoid(movement.endPosition, ellipsoid);
		var label = viewer.entities.getById(labelID);
		if (Cesium.defined(label)) {
			viewer.entities.remove(label);
			viewer.entities.add({
				id: labelID,
				position: cartesian,
				label: {
					text: labelText,
					font: '12px 黑体',
					verticalOrigin: Cesium.VerticalOrigin.TOP,
					horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
					pixelOffset: new Cesium.Cartesian2(15, -15),
					fillColor: Cesium.Color.BLACK,
					showBackground: true,
					backgroundColor: Cesium.Color.SILVER,
				},
			});
		} else {
			viewer.entities.add({
				id: labelID,
				position: cartesian,
				label: {
					text: labelText,
					font: '12px 黑体',
					verticalOrigin: Cesium.VerticalOrigin.TOP,
					horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
					pixelOffset: new Cesium.Cartesian2(15, -15),
					fillColor: Cesium.Color.BLACK,
					showBackground: true,
					backgroundColor: Cesium.Color.SILVER,
				},
			});
		}
	}, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
}
/*判断ID是否存在*/
function checkId(resolve, reject, url, layerName, idValue) {
	$.get(
		url,
		{
			cql_filter: 'ID' + ' = ' + idValue,
			request: 'GetFeature',
			version: '1.1.0',
			typename: layerName,
			outputformat: 'json',
		},
		function (data) {
			console.log(data);
			resolve(data.features.length);
		}
	);
}
/*在线追加多段线,执行已有记录的多部份追加
引用外部方法refreshLayer、clickForID、getFeatureByID、catchPoint*/
function addToExitPlOnLine(viewer, url, layername) {
	clickForID(viewer, url, layername, function (id) {
		getFeatureByID(url, layername, id, function (feature) {
			var canvas = viewer.scene.canvas;
			var handler = new Cesium.ScreenSpaceEventHandler(canvas);
			var handler2 = new Cesium.ScreenSpaceEventHandler(canvas);
			var positions = feature.geometry.coordinates;
			positions.push([]);
			catchPoint(
				viewer,
				'darwPoint',
				function (newpoint) {
					var ellipsoid = viewer.scene.globe.ellipsoid;
					positions[positions.length - 1].push([Cesium.Math.toDegrees(newpoint.longitude), Cesium.Math.toDegrees(newpoint.latitude)]);
					if (positions[positions.length - 1].length > 1) {
						var degreesArray = [];
						for (var i = 0; i < positions[positions.length - 1].length; i++) {
							degreesArray.push(positions[positions.length - 1][i][0]);
							degreesArray.push(positions[positions.length - 1][i][1]);
						}
						drawPL('temPL', Cesium.Cartesian3.fromDegreesArray(degreesArray));
					}
					handler.setInputAction(function (movement) {
						var temPositions = positions[positions.length - 1].concat();
						var cartesian = viewer.camera.pickEllipsoid(movement.endPosition, ellipsoid);
						var cartographic = viewer.scene.globe.ellipsoid.cartesianToCartographic(cartesian);
						temPositions.push([Cesium.Math.toDegrees(cartographic.longitude), Cesium.Math.toDegrees(cartographic.latitude)]);
						var degreesArray = [];
						for (var i = 0; i < temPositions.length; i++) {
							degreesArray.push(temPositions[i][0]);
							degreesArray.push(temPositions[i][1]);
						}
						drawPL('temPL2', Cesium.Cartesian3.fromDegreesArray(degreesArray));
					}, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
					handler.setInputAction(function () {
						handler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE);
						if (Cesium.defined(viewer.entities.getById('temPL2'))) {
							viewer.entities.remove(viewer.entities.getById('temPL2'));
						}
						if (Cesium.defined(viewer.entities.getById('temPL'))) {
							viewer.entities.remove(viewer.entities.getById('temPL'));
							// console.log(feature.id);
							synPLOnline(viewer, url, layername, positions, feature.id);
						}
						handler2.destroy();
						handler.destroy();
					}, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
				},
				true,
				handler2
			);
		});
	});
	function synPLOnline(viewer, url, layername, positions, geoId) {
		// console.log(positions);
		var header =
			'<?xml version="1.0" ?>' +
			'<wfs:Transaction ' +
			'version="1.1.0" ' +
			'service="WFS" ' +
			'xmlns="http://www.someserver.com/myns" ' +
			'xmlns:gml="http://www.opengis.net/gml" ' +
			'xmlns:ogc="http://www.opengis.net/ogc" ' +
			'xmlns:wfs="http://www.opengis.net/wfs" ' +
			'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ' +
			'xsi:schemaLocation="http://www.opengis.net/wfs ../wfs/1.1.0/WFS.xsd"> ' +
			'<wfs:Update typeName="' +
			layername +
			'"> ';
		var geo = '<wfs:Property> <wfs:Name>the_geom</wfs:Name> <wfs:Value> ' + '<gml:MultiLineString srsname="EPSG_4326">';
		geo = geo;
		+'<gml:lineStringMember>';
		for (var i = 0; i < positions.length; i++) {
			// i = positions.length - 1;
			geo = geo /* + '<gml:lineStringMember>' */ + '<gml:LineString>';
			for (var j = 0; j < positions[i].length; j++) {
				geo = geo + '<gml:coord><X>' + positions[i][j][1] + '</X><Y>' + positions[i][j][0] + '</Y></gml:coord>';
			}
			geo = geo + '</gml:LineString>' /* + '</gml:lineStringMember>' */;
		}
		geo = geo;
		+'</gml:lineStringMember>';
		geo = geo + '</gml:MultiLineString> </wfs:Value> </wfs:Property> ' /* + '</the_geom> ' */;
		var filter = '<ogc:Filter> ' + '<ogc:GmlObjectId id="' + geoId + '"/> ' + '</ogc:Filter> ';
		var footer = '</wfs:Update> ' + '</wfs:Transaction> ';
		var xml = header + geo + filter + footer;
		// console.log(xml);
		$.ajax({
			type: 'POST',
			url: url,
			data: xml,
			contentType: 'text/plain;charset=UTF-8',
			success: function (data) {
				// console.log(data);
				refreshLayer(viewer, url, layername);
			},
			error: function (err) {
				// console.log(err);
			},
		});
	}
	function drawPL(id, positions) {
		if (Cesium.defined(viewer.entities.getById(id))) {
			viewer.entities.remove(viewer.entities.getById(id));
		}
		viewer.entities.add({
			id: id,
			polyline: {
				positions: positions,
				material: Cesium.Color.RED,
				width: 1,
			},
		});
	}
}
/*在线增加多边形
调用外部方法checkId、catchPoint、getPropertyNamesFromGeoserver、refreshLayer、returnSmallLayername
*/
function addPolygonOnline(viewer, url, layername, fieldValues) {
	var myFirstPromise = new Promise(function (resolve, reject) {
		checkId(resolve, reject, url, layername, fieldValues['ID']);
	});
	myFirstPromise.then(function (successMessage) {
		if (successMessage > 0) {
			alert('存在重复ID元素');
			// console.log('存在重复ID元素');
			return;
		} else {
			var canvas = viewer.scene.canvas;
			var handler = new Cesium.ScreenSpaceEventHandler(canvas);
			var catchHandler = new Cesium.ScreenSpaceEventHandler(canvas);
			var positionsDegreesArray = [];
			catchPoint(
				viewer,
				'darwPoint',
				function (newpoint) {
					positionsDegreesArray.push(Cesium.Math.toDegrees(newpoint.longitude));
					positionsDegreesArray.push(Cesium.Math.toDegrees(newpoint.latitude));
					var positions = new Cesium.PolygonHierarchy(Cesium.Cartesian3.fromDegreesArray(positionsDegreesArray));
					handler.setInputAction(function (movement) {
						var ellipsoid = viewer.scene.globe.ellipsoid;
						var temPositionsDegreesArray = positionsDegreesArray.concat();
						var cartesian = viewer.camera.pickEllipsoid(movement.endPosition, ellipsoid);
						var cartographic = viewer.scene.globe.ellipsoid.cartesianToCartographic(cartesian);
						temPositionsDegreesArray.push(Cesium.Math.toDegrees(cartographic.longitude));
						temPositionsDegreesArray.push(Cesium.Math.toDegrees(cartographic.latitude));
						var positions = new Cesium.PolygonHierarchy(Cesium.Cartesian3.fromDegreesArray(temPositionsDegreesArray));
						drawPolygon('addPolygonOnline2', positions);
					}, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
					handler.setInputAction(function () {
						if (Cesium.defined(viewer.entities.getById('addPolygonOnline2'))) {
							viewer.entities.remove(viewer.entities.getById('addPolygonOnline2'));
							getPropertyNamesFromGeoserver(url, layername, function (data) {
								if (positionsDegreesArray.length < 6) {
									return;
								}
								// console.log(data);
								var header =
									'<?xml version="1.0"?> ' +
									'<wfs:Transaction ' +
									'version="1.1.0" ' +
									'service="WFS" ' +
									'xmlns:gml="http://www.opengis.net/gml" ' +
									'xmlns:wfs="http://www.opengis.net/wfs"> ' +
									'<wfs:Insert  idgen="UseExisting"> ' +
									'<' +
									returnSmallLayername(layername) +
									'> ';
								var geo =
									'<the_geom>' +
									'<gml:MultiPolygon srsName="EPSG:4326">' +
									'<gml:PolygonMember>' +
									'<gml:Polygon srsName="EPSG:4326">' +
									'<gml:exterior> ' +
									'<gml:LinearRing> <gml:posList>';
								geo =
									geo +
									positionsDegreesArray.toString().replace(/,/g, ' ') +
									' ' +
									positionsDegreesArray[0] +
									' ' +
									positionsDegreesArray[1];

								geo =
									geo +
									'</gml:posList></gml:LinearRing> ' +
									'</gml:exterior> ' +
									'</gml:Polygon> ' +
									'</gml:PolygonMember>' +
									'</gml:MultiPolygon>' +
									'</the_geom> ';
								var properties = '';
								for (var p in data) {
									properties = properties + '<' + p + '>' + fieldValues[p] + '</' + p + '>';
								}
								var footer = '</' + returnSmallLayername(layername) + '>' + '</wfs:Insert> ' + '</wfs:Transaction> ';
								var xml = header + geo + properties + footer;
								// console.log(xml);
								$.ajax({
									type: 'POST',
									url: url,
									data: xml,
									contentType: 'text/plain;charset=UTF-8',
									success: function (data) {
										console.log(data);
										refreshLayer(viewer, url, layername);
									},
									error: function (err) {
										console.log(err);
									},
								});
							});
						}
						if (Cesium.defined(viewer.entities.getById('pointLabel'))) {
							viewer.entities.remove(viewer.entities.getById('pointLabel'));
						}
						catchHandler.destroy();
						handler.destroy();
					}, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
				},
				true,
				catchHandler
			);
		}
	});

	function drawPolygon(id, hierarchy) {
		if (Cesium.defined(viewer.entities.getById(id))) {
			viewer.entities.remove(viewer.entities.getById(id));
		}
		viewer.entities.add({
			id: id,
			name: 'drawPolygon',
			polygon: {
				hierarchy: hierarchy,
				outline: true,
				outlineWidth: 100,
				outlineColor: Cesium.Color.RED,
				fill: false,
				arcType: Cesium.ArcType.RHUMB,
				// material: Cesium.Color.RED,
			},
		});
	}
}
/*在多边形内部扣去空洞
引用外部方法clickForID、getFeatureByID,degreesArrayToPosList、catchPoint、drawpolygon
 */
function addHoleInPolygonOnline(viewer, url, layername) {
	clickForID(viewer, url, layername, function (id) {
		getFeatureByID(url, layername, id, function (feature) {
			var coordinates = [];
			coordinates = feature.geometry.coordinates;
			//绘制多边形
			drawPolygon(feature.geometry.coordinates);
			var canvas = viewer.scene.canvas;
			var catchHandler = new Cesium.ScreenSpaceEventHandler(canvas);
			var handler = new Cesium.ScreenSpaceEventHandler(canvas);
			var newHoleArray = [];
			var inNum = -1;
			catchPoint(
				viewer,
				'darwPoint',
				function (newpoint) {
					function judgeInPolygon(newpoint, positions) {
						var inNum = -1;
						longitude = Cesium.Math.toDegrees(newpoint.longitude);
						latitude = Cesium.Math.toDegrees(newpoint.latitude);
						for (var i = 0; i < positions.length; i++) {
							//数学坐标判断
							var maxX = 0,
								minX = 180,
								maxY = 0,
								minY = 90;
							for (var j = 0; j < positions[i][0].length; j++) {
								if (positions[i][0][j][0] > maxX) {
									maxX = positions[i][0][j][0];
								}
								if (positions[i][0][j][0] < minX) {
									minX = positions[i][0][j][0];
								}
								if (positions[i][0][j][1] > maxY) {
									maxY = positions[i][0][j][1];
								}
								if (positions[i][0][j][1] < minY) {
									minY = positions[i][0][j][1];
								}
							}
							if (longitude < minX || longitude > maxX || latitude < minY || latitude > maxY) {
								// inNum = -1;
							} else {
								// return i;
								nvert = positions[i][0].length;
								verts = positions[i][0];
								testx = longitude;
								testy = latitude;
								pnpoly(nvert, verts, testx, testy, i);
								function pnpoly(nvert, verts, testx, testy, n) {
									var i = 0,
										j = 0,
										c = 0;
									for (i = 0, j = nvert - 1; i < nvert; j = i++) {
										if (
											verts[i][1] > testy != verts[j][1] > testy &&
											testx < ((verts[j][0] - verts[i][0]) * (testy - verts[i][1])) / (verts[j][1] - verts[i][1]) + verts[i][0]
										) {
											inNum = n;
										}
									}
								}
							}
						}
						return inNum;
					}
					if (inNum == -1) {
						inNum = judgeInPolygon(newpoint, coordinates);
						if (inNum != -1) {
							newHoleArray.push([Cesium.Math.toDegrees(newpoint.longitude), Cesium.Math.toDegrees(newpoint.latitude)]);
						}
					} else {
						if (newHoleArray.length == 0) {
							newHoleArray.push([Cesium.Math.toDegrees(newpoint.longitude), Cesium.Math.toDegrees(newpoint.latitude)]);
						} else {
							newHoleArray.push([Cesium.Math.toDegrees(newpoint.longitude), Cesium.Math.toDegrees(newpoint.latitude)]);

							handler.setInputAction(function (movement) {
								var tem = [];
								tem = coordinates[inNum].concat();
								//绘制的新ring
								var temNewRingCoords = [];
								temNewRingCoords = newHoleArray.concat();
								var ellipsoid = viewer.scene.globe.ellipsoid;
								var cartesian = viewer.camera.pickEllipsoid(movement.endPosition, ellipsoid);
								var cartographic = viewer.scene.globe.ellipsoid.cartesianToCartographic(cartesian);
								temNewRingCoords.push([Cesium.Math.toDegrees(cartographic.longitude), Cesium.Math.toDegrees(cartographic.latitude)]);
								//-
								tem.push(temNewRingCoords);
								var temCoordinates = coordinates.concat();
								temCoordinates[inNum] = tem;
								drawPolygon(temCoordinates);
							}, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
						}
					}
				},
				true,
				catchHandler
			);
			handler.setInputAction(function () {
				for (var i = 0; i < coordinates.length; i++) {
					if (Cesium.defined(viewer.entities.getById('addHoleInPolygonOnline-' + i))) {
						viewer.entities.remove(viewer.entities.getById('addHoleInPolygonOnline-' + i));
					}
				}
				handler.destroy();
				catchHandler.destroy();
				//同步远端服务
				newHoleArray.push(newHoleArray[0]);
				coordinates[inNum].push(newHoleArray);
				synAddHoleInPolygonOnline(url, layername, feature.id, coordinates);
			}, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
		});
	});
}
/*在线编辑多边形节点
引用外部方法clickForID、getFeatureByID、catchPoint、refreshLayer、synAddHoleInPolygonOnline、drawPolygon
*/
function editPolygonOnline(viewer, url, layername) {
	clickForID(viewer, url, layername, function (id) {
		getFeatureByID(url, layername, id, function (feature) {
			var entity; //选择节点
			var positions = feature.geometry.coordinates;
			//绘制多边形
			drawPolygon(positions);
			//展绘坐标点
			drawPointByCoordinates(positions);
			var canvas = viewer.scene.canvas;
			var catchHandler = new Cesium.ScreenSpaceEventHandler(canvas);
			var handler = new Cesium.ScreenSpaceEventHandler(canvas);
			//右键点击结束当前操作
			handler.setInputAction(function () {
				//结束catchpoint操作
				catchHandler.destroy();
				catchHandler = new Cesium.ScreenSpaceEventHandler(canvas);
				//取消catchPoint提示
				if (Cesium.defined(viewer.entities.getById('pointLabel'))) {
					viewer.entities.remove(viewer.entities.getById('pointLabel'));
				}
				//还原选择节点的颜色
				if (Cesium.defined(entity)) {
					entity._label.backgroundColor = Cesium.Color.SILVER;
					entity._point.color = Cesium.Color.ORANGE;
				}
			}, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
			// SHIFT+左键双击结束编辑任务
			handler.setInputAction(
				function () {
					//结束catchpoint操作
					catchHandler.destroy();
					//取消catchPoint提示
					if (Cesium.defined(viewer.entities.getById('pointLabel'))) {
						viewer.entities.remove(viewer.entities.getById('pointLabel'));
					}
					//还原选择节点的颜色
					if (Cesium.defined(entity)) {
						entity._label.backgroundColor = Cesium.Color.SILVER;
						entity._point.color = Cesium.Color.ORANGE;
					}
					handler.destroy();
					//清除展点坐标//清除前端多变形
					if (positions.length > 0) {
						for (var i = 0; i < positions.length; i++) {
							if (Cesium.defined(viewer.entities.getById('addHoleInPolygonOnline-' + i))) {
								viewer.entities.remove(viewer.entities.getById('addHoleInPolygonOnline-' + i));
							}
							for (var j = 0; j < positions[i].length; j++) {
								for (var k = 0; k < positions[i][j].length - 1; k++) {
									if (Cesium.defined(viewer.entities.getById(i + '-' + j + '-' + k))) {
										viewer.entities.remove(viewer.entities.getById(i + '-' + j + '-' + k));
									}
								}
							}
						}
					}
				},
				Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK,
				Cesium.KeyboardEventModifier.SHIFT
			);

			//CTRL+左键双击编辑节点
			handler.setInputAction(
				function (movement) {
					var featurePicked = viewer.scene.pick(movement.position);
					try {
						if (featurePicked.id instanceof Cesium.Entity || featurePicked.id._name == 'editPolygonOnline') {
							entity = featurePicked.id;
							entity._label.backgroundColor = Cesium.Color.RED;
							entity._point.color = Cesium.Color.RED;
							catchPoint(
								viewer,
								'darwPoint',
								function (newpoint) {
									var idSplit = entity.id.split('-');
									// 移动点号标注并恢复标注样式
									viewer.entities.getById(entity.id).position = Cesium.Cartesian3.fromDegrees(
										Cesium.Math.toDegrees(newpoint.longitude),
										Cesium.Math.toDegrees(newpoint.latitude),
										0
									);
									entity._label.backgroundColor = Cesium.Color.SILVER;
									entity._point.color = Cesium.Color.ORANGE;
									//重绘多边形
									idSplitArr = entity.id.split('-');
									//如果编辑的为首节点，同时修改对应末端闭合节点
									if (idSplitArr[2] == '0') {
										var len = positions[parseInt(idSplitArr[0])][parseInt(idSplitArr[1])].length;
										positions[parseInt(idSplitArr[0])][parseInt(idSplitArr[1])][len - 1][0] = Cesium.Math.toDegrees(newpoint.longitude);
										positions[parseInt(idSplitArr[0])][parseInt(idSplitArr[1])][len - 1][1] = Cesium.Math.toDegrees(newpoint.latitude);
									}
									positions[parseInt(idSplitArr[0])][parseInt(idSplitArr[1])][parseInt(idSplitArr[2])][0] = Cesium.Math.toDegrees(
										newpoint.longitude
									);
									positions[parseInt(idSplitArr[0])][parseInt(idSplitArr[1])][parseInt(idSplitArr[2])][1] = Cesium.Math.toDegrees(
										newpoint.latitude
									);
									drawPolygon(positions);
									//同步后端图形
									synAddHoleInPolygonOnline(url, layername, feature.id, positions);
								},
								false,
								catchHandler
							);
						}
					} catch (err) {
						console.log(err);
					}
				},
				Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK,
				Cesium.KeyboardEventModifier.CTRL
			);
			// alt+左键单击多段线，添加点位。
			handler.setInputAction(
				function (movement) {
					var cartesian = viewer.camera.pickEllipsoid(movement.position, viewer.scene.globe.ellipsoid);
					var cartographic = Cesium.Cartographic.fromCartesian(cartesian);
					var coordAdded = [Cesium.Math.toDegrees(cartographic.longitude), Cesium.Math.toDegrees(cartographic.latitude)];
					var featurePicked = viewer.scene.pick(movement.position);
					try {
						if (featurePicked.id instanceof Cesium.Entity || featurePicked.id._name == 'drawPolygon') {
							//根据entity的ID获取选择的实体位于多边形的哪一部分
							var idSplitArr = featurePicked.id._id.split('-');
							var partNo = parseInt(idSplitArr[1]);

							increaseCoordinates(positions, coordAdded);
							//展点坐标重绘
							drawPointByCoordinates(positions);
							//多边形重绘
							drawPolygon(positions);
							//同步后端图形
							synAddHoleInPolygonOnline(url, layername, feature.id, positions);
							function increaseCoordinates(positions, coordAdded) {
								for (var i = 0; i < positions.length; i++) {
									for (var j = 0; j < positions[i].length; j++) {
										for (var k = 0; k < positions[i][j].length - 1; k++) {
											if (
												Math.abs(
													(positions[i][j][k][0] - positions[i][j][k + 1][0]) / (positions[i][j][k][1] - positions[i][j][k + 1][1]) -
														(positions[i][j][k][0] - coordAdded[0]) / (positions[i][j][k][1] - coordAdded[1])
												) < 0.05 &&
												((positions[i][j][k][0] < coordAdded[0] && positions[i][j][k + 1][0] > coordAdded[0]) ||
													(positions[i][j][k][0] > coordAdded[0] && positions[i][j][k + 1][0] < coordAdded[0]))
											) {
												positions[i][j][positions[i][j].length] = [0, 0];
												for (var l = positions[i][j].length - 1; l > k + 1; l--) {
													positions[i][j][l] = positions[i][j][l - 1];
												}
												positions[i][j][k + 1] = coordAdded;
												break;
											}
										}
									}
								}
							}
						}
					} catch (error) {
						// console.log(error);
					}
				},
				Cesium.ScreenSpaceEventType.LEFT_CLICK,
				Cesium.KeyboardEventModifier.ALT
			);

			//alt+左键双击点号，移除点位。
			handler.setInputAction(
				function (movement) {
					setTimeout(() => {
						var featurePicked = viewer.scene.pick(movement.position);
						try {
							if (featurePicked.id instanceof Cesium.Entity || featurePicked.id._name == 'editPolygonOnline') {
								//获取要移除点的id
								var idSplit = featurePicked.id.id.split('-');
								//清除展点坐标//清除前端多变形
								if (positions.length > 0) {
									for (var i = 0; i < positions.length; i++) {
										if (Cesium.defined(viewer.entities.getById('addHoleInPolygonOnline-' + i))) {
											viewer.entities.remove(viewer.entities.getById('addHoleInPolygonOnline-' + i));
										}
										for (var j = 0; j < positions[i].length; j++) {
											for (var k = 0; k < positions[i][j].length - 1; k++) {
												if (Cesium.defined(viewer.entities.getById(i + '-' + j + '-' + k))) {
													viewer.entities.remove(viewer.entities.getById(i + '-' + j + '-' + k));
												}
											}
										}
									}
								}
								//根据移除点的id对坐标进行重排
								if (parseInt(idSplit[2]) == 0) {
									//掐头
									positions[parseInt(idSplit[0])][parseInt(idSplit[1])].splice(parseInt(idSplit[2]), 1);
									var len = positions[parseInt(idSplit[0])][parseInt(idSplit[1])].length;
									//去尾
									positions[parseInt(idSplit[0])][parseInt(idSplit[1])].splice(len - 1, 1);
									//追加闭合点
									positions[parseInt(idSplit[0])][parseInt(idSplit[1])].push(positions[parseInt(idSplit[0])][parseInt(idSplit[1])][0]);
								} else {
									positions[parseInt(idSplit[0])][parseInt(idSplit[1])].splice(parseInt(idSplit[2]), 1);
								}
								//根据条件判断是否删除环或者部分
								if (positions.length > 0) {
									//判断每一部分
									for (var i = positions.length - 1; i >= 0; i--) {
										for (var j = positions[i].length - 1; j >= 0; j--) {
											//判断每个环，如果环内点少于4个（带首尾闭合点2个），删除环
											if (positions[i][j].length < 4) {
												positions[i].splice(j, 1);
											}
										}
										if (positions[i].length == 0) {
											positions.splice(i, 1);
										}
									}
								}
								//根据条件判断重绘或者删除
								if (positions.length == 0) {
									//删除对象
									// removeByGeoID(viewer, url, layername, feature.id);
								} else {
									//展点坐标重绘
									drawPointByCoordinates(positions);
									//多边形重绘
									drawPolygon(positions);
									//同步后端图形
									synAddHoleInPolygonOnline(url, layername, feature.id, positions);
								}
							}
						} catch (err) {
							console.log(err);
						}
					}, 200);
				},
				Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK,
				Cesium.KeyboardEventModifier.ALT
			);
		});
	});

	function drawPointByCoordinates(coordinates) {
		if (coordinates.length > 0) {
			for (var i = 0; i < coordinates.length; i++) {
				for (var j = 0; j < coordinates[i].length; j++) {
					for (var k = 0; k < coordinates[i][j].length - 1; k++) {
						if (Cesium.defined(viewer.entities.getById(i + '-' + j + '-' + k))) {
							viewer.entities.remove(viewer.entities.getById(i + '-' + j + '-' + k));
						}
						viewer.entities.add({
							id: i + '-' + j + '-' + k,
							name: 'editPolygonOnline',
							position: Cesium.Cartesian3.fromDegrees(coordinates[i][j][k][0], coordinates[i][j][k][1], 0),
							point: {
								pixelSize: 5,
								color: Cesium.Color.ORANGE,
							},
							label: {
								text: i + '-' + j + '-' + k,
								font: '12px 黑体',
								verticalOrigin: Cesium.VerticalOrigin.TOP,
								horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
								pixelOffset: new Cesium.Cartesian2(-55, -15),
								fillColor: Cesium.Color.BLACK,
								showBackground: true,
								backgroundColor: Cesium.Color.SILVER,
							},
						});
					}
				}
			}
		}
	}

	function addLabelByMove(handler, labelID) {
		handler.setInputAction(function (movement) {
			var ellipsoid = viewer.scene.globe.ellipsoid;
			var cartesian = viewer.camera.pickEllipsoid(movement.endPosition, ellipsoid);
			var label = viewer.entities.getById(labelID);
			if (Cesium.defined(label)) {
				viewer.entities.remove(label);
				viewer.entities.add({
					id: labelID,
					position: cartesian,
					label: {
						text: labelText,
						font: '12px 黑体',
						verticalOrigin: Cesium.VerticalOrigin.TOP,
						horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
						pixelOffset: new Cesium.Cartesian2(15, -15),
						fillColor: Cesium.Color.BLACK,
						showBackground: true,
						backgroundColor: Cesium.Color.SILVER,
					},
				});
			} else {
				viewer.entities.add({
					id: labelID,
					position: cartesian,
					label: {
						text: labelText,
						font: '12px 黑体',
						verticalOrigin: Cesium.VerticalOrigin.TOP,
						horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
						pixelOffset: new Cesium.Cartesian2(15, -15),
						fillColor: Cesium.Color.BLACK,
						showBackground: true,
						backgroundColor: Cesium.Color.SILVER,
					},
				});
			}
		}, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
	}
}
/*在线追加多边形，形成多部份
调用外部方法：clickForID，getFeatureByID，synAddHoleInPolygonOnline，drawPolygon
*/
function addToExitPolygon(viewer, url, layername) {
	clickForID(viewer, url, layername, function (Id) {
		getFeatureByID(url, layername, Id, function (feature) {
			var positions = feature.geometry.coordinates;
			var canvas = viewer.scene.canvas;
			var handler = new Cesium.ScreenSpaceEventHandler(canvas);
			var catchHandler = new Cesium.ScreenSpaceEventHandler(canvas);
			var newRingCoords = [];
			drawPolygon(positions);
			catchPoint(
				viewer,
				'drawPoint',
				function (newpoint) {
					newRingCoords.push([Cesium.Math.toDegrees(newpoint.longitude), Cesium.Math.toDegrees(newpoint.latitude)]);
					if (newRingCoords.length >= 2) {
						handler.setInputAction(function (movement) {
							var temNewRingCoords = newRingCoords.concat();
							var ellipsoid = viewer.scene.globe.ellipsoid;
							var cartesian = viewer.camera.pickEllipsoid(movement.endPosition, ellipsoid);
							var cartographic = viewer.scene.globe.ellipsoid.cartesianToCartographic(cartesian);
							temNewRingCoords.push([Cesium.Math.toDegrees(cartographic.longitude), Cesium.Math.toDegrees(cartographic.latitude)]);
							var temPositions = positions.concat();
							temPositions.push([temNewRingCoords]);
							//绘制临时多边形
							drawPolygon(temPositions);
						}, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
						handler.setInputAction(function () {
							catchHandler.destroy();
							handler.destroy();
							newRingCoords.push(newRingCoords[0]);
							positions.push([newRingCoords]);
							//取消catchPoint提示
							if (Cesium.defined(viewer.entities.getById('pointLabel'))) {
								viewer.entities.remove(viewer.entities.getById('pointLabel'));
							}
							//清除展点坐标//清除前端多变形
							if (positions.length > 0) {
								for (var i = 0; i < positions.length; i++) {
									if (Cesium.defined(viewer.entities.getById('addHoleInPolygonOnline-' + i))) {
										viewer.entities.remove(viewer.entities.getById('addHoleInPolygonOnline-' + i));
									}
								}
							}
							//同步后台图形服务
							synAddHoleInPolygonOnline(url, layername, feature.id, positions);
						}, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
					}
				},
				true,
				catchHandler
			);
			handler.setInputAction(function () {
				catchHandler.destroy();
				handler.destroy();
				//取消catchPoint提示
				if (Cesium.defined(viewer.entities.getById('pointLabel'))) {
					viewer.entities.remove(viewer.entities.getById('pointLabel'));
				}
				//清除展点坐标//清除前端多变形
				if (positions.length > 0) {
					for (var i = 0; i < positions.length; i++) {
						if (Cesium.defined(viewer.entities.getById('addHoleInPolygonOnline-' + i))) {
							viewer.entities.remove(viewer.entities.getById('addHoleInPolygonOnline-' + i));
						}
					}
				}
			}, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
		});
	});
}
/*将测量坐标转数学坐标
输入和参会结果均为数组：[[],[],[],[]]
*/
function degreesArrayToPosList(degreesArray) {
	var posList = [];
	if (degreesArray.length > 0) {
		for (var i = 0; i < degreesArray.length; i++) {
			if (degreesArray[i].length > 0) {
				posList.push([]);
				for (var j = degreesArray[i].length - 1; j >= 0; j--) {
					posList[posList.length - 1].push(degreesArray[i][j]);
				}
			}
		}
		return posList;
	} else {
		return [];
	}
}
/*根据geoid和坐标对多边形图形进行更新*/
function synAddHoleInPolygonOnline(url, layername, geoId, positions) {
	var degreesArray = []; //多边形外边线数组，每一条外边线为一个成员
	var holesArray = []; //多边形内边线数组，每一条内边线为一个成员
	for (var i = 0; i < positions.length; i++) {
		degreesArray.push([]);
		holesArray.push([]);
		for (var j = 0; j < positions[i].length; j++) {
			if (j == 0) {
				for (var k = 0; k < positions[i][j].length; k++) {
					degreesArray[i].push(positions[i][j][k][0]);
					degreesArray[i].push(positions[i][j][k][1]);
				}
			} else {
				holesArray[i].push([]);

				for (var k = 0; k < positions[i][j].length; k++) {
					holesArray[i][holesArray[i].length - 1].push(positions[i][j][k][0]);
					holesArray[i][holesArray[i].length - 1].push(positions[i][j][k][1]);
				}
			}
		}
	}
	function degreesArrayToPosList(degreesArray) {
		var posList = [];
		for (var k = 0; k < degreesArray.length; k++) {
			posList.push([]);
			for (var i = degreesArray[k].length - 1; i >= 0; i--) {
				posList[k].push(degreesArray[k][i]);
			}
		}
		return posList;
	}
	function holesArrayToPosList(holesArray) {
		var posList = [];
		for (var i = 0; i < holesArray.length; i++) {
			posList.push([]);
			if (holesArray[i].length > 0) {
				for (var j = 0; j < holesArray[i].length; j++) {
					posList[i].push([]);
					for (var k = holesArray[i][j].length - 1; k >= 0; k--) {
						posList[i][j].push(holesArray[i][j][k]);
					}
				}
			}
		}
		return posList;
	}
	degreesArray = degreesArrayToPosList(degreesArray);
	holesArray = holesArrayToPosList(holesArray);
	var header =
		'<?xml version="1.0" ?>' +
		'<wfs:Transaction ' +
		'version="1.1.0" ' +
		'service="WFS" ' +
		'xmlns="http://www.someserver.com/myns" ' +
		'xmlns:gml="http://www.opengis.net/gml" ' +
		'xmlns:ogc="http://www.opengis.net/ogc" ' +
		'xmlns:wfs="http://www.opengis.net/wfs" ' +
		'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ' +
		'xsi:schemaLocation="http://www.opengis.net/wfs ../wfs/1.1.0/WFS.xsd"> ' +
		'<wfs:Update typeName="' +
		layername +
		'"> ';

	var geo = '<wfs:Property>' + '<wfs:Name>the_geom</wfs:Name> ' + '<wfs:Value> ' + '<gml:MultiPolygon srsname="EPSG:4326">';
	for (var i = 0; i < degreesArray.length; i++) {
		geo =
			geo + '<gml:polygonMember>' + '<gml:Polygon>' + '<gml:exterior> ' + '<gml:LinearRing>' + '<gml:posList  decimal="." cs=" " ts="">';
		geo = geo + degreesArray[i].toString().replace(/,/g, ' ');
		geo = geo + '</gml:posList>  ' + '</gml:LinearRing> ' + '</gml:exterior> ';
		if (holesArray[i].length > 0) {
			for (var j = 0; j < holesArray[i].length; j++) {
				geo =
					geo +
					'<gml:interior> ' +
					'<gml:LinearRing>' +
					'<gml:posList  decimal="." cs=" " ts="">' +
					holesArray[i][j].toString().replace(/,/g, ' ') +
					'</gml:posList>  ' +
					'</gml:LinearRing> ' +
					' </gml:interior> ';
			}
		}

		geo = geo + '</gml:Polygon> ' + '</gml:polygonMember> ';
	}
	geo = geo + '</gml:MultiPolygon> ' + '</wfs:Value>' + '</wfs:Property>';
	var filter = '<ogc:Filter> ' + '<ogc:GmlObjectId id="' + geoId + '"/> ' + '</ogc:Filter> ';
	var footer = '</wfs:Update> ' + '</wfs:Transaction> ';
	var xml = header + geo + filter + footer;
	$.ajax({
		type: 'POST',
		url: url,
		data: xml,
		contentType: 'text/plain;charset=UTF-8',
		success: function (data) {
			console.log(data);
			refreshLayer(viewer, url, layername);
		},
		error: function (err) {
			console.log(err);
		},
	});
}
/*根据坐标前端绘制多边形*/
function drawPolygon(positions) {
	var degreesArray = []; //多边形外边线数组，每一条外边线为一个成员
	var holesArray = []; //多边形内边线数组，每一条内边线为一个成员
	var holes = [];
	var hierarchy;
	for (var i = 0; i < positions.length; i++) {
		degreesArray.push([]);
		for (var j = 0; j < positions[i].length; j++) {
			if (j == 0) {
				for (var k = 0; k < positions[i][j].length; k++) {
					degreesArray[i].push(positions[i][j][k][0]);
					degreesArray[i].push(positions[i][j][k][1]);
				}
			} else {
				holesArray.push([]);
				for (var k = 0; k < positions[i][j].length; k++) {
					holesArray[holesArray.length - 1].push(positions[i][j][k][0]);
					holesArray[holesArray.length - 1].push(positions[i][j][k][1]);
				}
			}
		}

		for (var j2 = 0; j2 < holesArray.length; j2++) {
			holes.push({ positions: Cesium.Cartesian3.fromDegreesArray(holesArray[j2]) });
		}
	}
	for (var i = 0; i < degreesArray.length; i++) {
		hierarchy = {
			positions: Cesium.Cartesian3.fromDegreesArray(degreesArray[i]),
			holes: holes,
		};
		drawPolygonTem('addHoleInPolygonOnline-' + i, hierarchy);
	}
	function drawPolygonTem(id, hierarchy) {
		if (Cesium.defined(viewer.entities.getById(id))) {
			viewer.entities.remove(viewer.entities.getById(id));
		}
		var tem = viewer.entities.add({
			id: id,
			name: 'drawPolygon',
			polygon: {
				hierarchy: hierarchy,
				outline: true,
				outlineWidth: 2,
				outlineColor: Cesium.Color.RED,
				fill: false,
				arcType: Cesium.ArcType.RHUMB,
				material: new Cesium.GridMaterialProperty({
					color: Cesium.Color.RED,
					cellAlpha: 0,
					lineCount: new Cesium.Cartesian2(8, 8),
					lineThickness: new Cesium.Cartesian2(1, 1),
				}),
			},
		});
	}
}

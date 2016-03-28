/* jshint esversion: 6 */

/**
 * Controls the inventory and refreshes the data.
 * @param  {String} 'healthController' Controller name
 * @param  {function} AngularJS services
 * @return {null}
 */
app.controller('inventoryController', ['$scope', '$rootScope', 'refreshData', 'cache', 'restService', 'logService', 'SEVERITY',
    function($scope, $rootScope, refreshData, cache, restService, logService, SEVERITY) {
        'use strict';

        // Add this controller to the loaded controllers.
        refreshData.loadController('inventoryController');
        refreshData.refreshData('inventoryController', 'Refreshing inventory data.');

        $scope.latest = [];
        $scope.inventory = [];
        $scope.cache = cache.getCache("inventoryController-inventory");

        /**
         * Load the data from the controller into the view.
         * @return {null}
         */
        $scope.load = function() {
            var expirationDates = {};

            function createItem(response) {
                var product = response.data.product,
                    barcode = response.data.code,
                    item = {
                        name: product.product_name,
                        image: product.image_front_thumb_url,
                        expires: expirationDates[barcode],
                        barcode: barcode
                    };

                $scope.newList.push(item);
                $scope.cache[barcode] = item;
            }

            function latestInventoryError(response) {
                $rootScope.addAlert(SEVERITY.WARNING, "Something went wrong and the latest inventory could not be found.");
            }

            var promise = restService.getLatest();

            promise.success(function(response) {
                $scope.newList = [];
                var maxLength = (response.data.length < 3) ? response.data.length : 3,
                    i = 0,
                    elBarcode,
                    expiresDate,
                    item;

                for (i; i < maxLength; i++) {
                    elBarcode = response.data[i].barcode;
                    expiresDate = response.data[i].expirationdate;

                    // This is necessary for the REST call below.
                    expirationDates[elBarcode] = expiresDate;

                    // Search in the cache first.
                    if (elBarcode in $scope.cache) {
                        item = $scope.cache[elBarcode];
                        $scope.newList.push(item);
                    } else {
                        logService.debug('inventoryController', 'REST call for barcode ' + elBarcode);

                        var promise = restService.searchBarcode(elBarcode);
                        promise.success(createItem);
                        promise.error(latestInventoryError);
                    }
                }

                $scope.$watch('newList', function(n) {
                    if (n.length === maxLength) {
                        if (!$scope.isInventoryEqual()) {
                            $scope.latest = $scope.newList;
                        }
                    }
                }, true);
            });

            promise.error(function() {});

            promise = restService.getInventory();

            promise.success(function(response) {
                $scope.newInventory = [];

                function createProduct(response) {
                    var barcode = response.data.code,
                        product = response.data.product.product_name,
                        item = {
                            name: response.data.product.product_name,
                            image: response.data.product.image_front_thumb_url,
                            expires: expirationDates[barcode],
                            barcode: barcode
                        };

                    $scope.cache[barcode] = item;
                    $scope.newInventory.push(product);

                    $rootScope.addAlert(0, product + " was added to the inventory.");
                }

                function inventoryError(response) {
                    $rootScope.addAlert(SEVERITY.WARNING, "Something went wrong and the latest inventory could not be found.");
                }

                var item,
                    index,
                    barcode,
                    product;

                for (item in response.data) {
                    index = $scope.inventory.indexOf(response.data[item]);

                    if (index < 0) {
                        barcode = response.data[item].barcode;

                        // Search in the cache first.
                        if (barcode in $scope.cache) {
                            item = $scope.cache[barcode];
                            $scope.newInventory.push(item);
                            logService.debug('inventoryController', 'Found ' + barcode + ' in cache.');
                        } else {
                            logService.debug('inventoryController', 'REST call for barcode ' + barcode);
                            var promise = restService.searchBarcode(barcode);
                            promise.success(createProduct);
                            promise.error(inventoryError);
                        }
                    }
                }
                $scope.inventory = $scope.newInventory;
            });

            promise.error(function(response) {});
        };

        /**
         * Returns whether or not the inventory has changed.
         * @return {boolean} Whether or not the inventory has changed.
         */
        $scope.isInventoryEqual = function() {
            var equal = false;

            if ($scope.newList.length == $scope.latest.length) {
                for (var item in $scope.newList) {
                    var element = $scope.newList[item].barcode;

                    var found = false;
                    for (var otherItem in $scope.latest) {
                        var otherElement = $scope.latest[otherItem].barcode;

                        if (otherElement == element) {
                            found = true;
                            break;
                        }
                    }
                    equal = found;
                }
            }

            return equal;
        };

        $scope.load();

        // Register event handlers
        $rootScope.$on("refreshInventory", function() {
            $scope.load();
        });

        var saveCache = function(){
            cache.setCache("inventoryController-inventory", $scope.cache);
        };

        window.onbeforeunload = saveCache;

        // Cleanup
        $scope.$on("$destroy", function() {
            saveCache();
            refreshDataService.unloadController('inventoryController');
        });
    }
]);
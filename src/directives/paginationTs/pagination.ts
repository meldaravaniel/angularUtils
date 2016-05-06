module angularUtils.directives.paginationTs {

    import IDirective = angular.IDirective;
    import IDirectiveCompileFn = angular.IDirectiveCompileFn;
    import IDirectivePrePost = angular.IDirectivePrePost;
    import IAugmentedJQuery = angular.IAugmentedJQuery;
    import IAttributes = angular.IAttributes;
    import IDirectiveLinkFn = angular.IDirectiveLinkFn;
    import IScope = angular.IScope;
    import ICompiledExpression = angular.ICompiledExpression;

    var DEFAULT_ID = '__default';

    /**
     * This service allows the various parts of the module to communicate and stay in sync.
     */
    class PaginationService {
        instances:any = {};
        lastRegisteredInstance:any;

        public registerInstance(instanceId) {
            if (typeof this.instances[instanceId] === 'undefined') {
                this.instances[instanceId] = {
                    asyncMode: false
                };
                this.lastRegisteredInstance = instanceId;
            }
        };

        // public deregisterInstance(instanceId) {
        //     delete this.instances[instanceId];
        // };

        public isRegistered(instanceId) {
            return (typeof this.instances[instanceId] !== 'undefined');
        };

        // public getLastInstanceId() {
        //     return this.lastRegisteredInstance;
        // };

        public setCurrentPageParser(instanceId, val, scope) {
            this.instances[instanceId].currentPageParser = val;
            this.instances[instanceId].context = scope;
        };

        public setCurrentPage(instanceId, val) {
            this.instances[instanceId].currentPageParser.assign(this.instances[instanceId].context, val);
        };

        public getCurrentPage(instanceId) {
            var parser = this.instances[instanceId].currentPageParser;
            return parser ? parser(this.instances[instanceId].context) : 1;
        };

        public setItemsPerPage(instanceId, val) {
            this.instances[instanceId].itemsPerPage = val;
        };

        public getItemsPerPage(instanceId) {
            return this.instances[instanceId].itemsPerPage;
        };

        public setCollectionLength(instanceId, val) {
            this.instances[instanceId].collectionLength = val;
        };

        public getCollectionLength(instanceId) {
            return this.instances[instanceId].collectionLength;
        };

        public setAsyncModeTrue(instanceId) {
            this.instances[instanceId].asyncMode = true;
        };

        public setAsyncModeFalse(instanceId) {
            this.instances[instanceId].asyncMode = false;
        };

        public isAsyncMode(instanceId) {
            return this.instances[instanceId].asyncMode;
        };
    }

    /**
     * This provider allows global configuration of the template path used by the pagination-controls directive.
     */
    class PaginationTemplate {

        static templatePath:string = 'angularUtils.directives.pagination.template';
        templateString:string = '';

        /**
         * Set a templateUrl to be used by all instances of <pagination-controls>
         * @param {String} path
         */
        public setPath(path) {
            PaginationTemplate.templatePath = path;
        };

        /**
         * Set a string of HTML to be used as a template by all instances
         * of <pagination-controls>. If both a path *and* a string have been set,
         * the string takes precedence.
         * @param {String} str
         */
        public setString(str) {
            this.templateString = str;
        };

        public getPath() {
            return PaginationTemplate.templatePath;
        }

        public getString() {
            return this.templateString;
        }

        public $get() {
            return {
                getPath: this.getPath,
                getString: this.getString
            };
        };
    }

    /**
     * This filter slices the collection into pages based on the current page number and number of items per page.
     * @param paginationService
     * @returns {Function}
     */
    function ItemsPerPage(paginationService) {

        return (collection, itemsPerPage, paginationId) => {
            if (typeof (paginationId) === 'undefined') {
                paginationId = DEFAULT_ID;
            }
            if (!paginationService.isRegistered(paginationId)) {
                throw 'pagination directive: the itemsPerPage id argument (id: ' + paginationId + ') does not match a registered pagination-id.';
            }
            var end;
            var start;
            if (angular.isObject(collection)) {
                itemsPerPage = parseInt(itemsPerPage) || 9999999999;
                if (paginationService.isAsyncMode(paginationId)) {
                    start = 0;
                } else {
                    start = (paginationService.getCurrentPage(paginationId) - 1) * itemsPerPage;
                }
                end = start + itemsPerPage;
                paginationService.setItemsPerPage(paginationId, itemsPerPage);

                if (collection instanceof Array) {
                    // the array just needs to be sliced
                    return collection.slice(start, end);
                } else {
                    // in the case of an object, we need to get an array of keys, slice that, then map back to
                    // the original object.
                    var slicedObject = {};
                    angular.forEach(keys(collection).slice(start, end), function (key) {
                        slicedObject[key] = collection[key];
                    });
                    return slicedObject;
                }
            } else {
                return collection;
            }
        };
    }

    function PaginationControlsTemplateInstaller($templateCache) {
        $templateCache.put('angularUtils.directives.pagination.template', '<ul class="pagination" ng-if="1 < pages.length || !autoHide"><li ng-if="boundaryLinks" ng-class="{ disabled : pagination.current == 1 }"><a href="" ng-click="setCurrent(1)">&laquo;</a></li><li ng-if="directionLinks" ng-class="{ disabled : pagination.current == 1 }"><a href="" ng-click="setCurrent(pagination.current - 1)">&lsaquo;</a></li><li ng-repeat="pageNumber in pages track by tracker(pageNumber, $index)" ng-class="{ active : pagination.current == pageNumber, disabled : pageNumber == \'...\' || ( ! autoHide && pages.length === 1 ) }"><a href="" ng-click="setCurrent(pageNumber)">{{ pageNumber }}</a></li><li ng-if="directionLinks" ng-class="{ disabled : pagination.current == pagination.last }"><a href="" ng-click="setCurrent(pagination.current + 1)">&rsaquo;</a></li><li ng-if="boundaryLinks"  ng-class="{ disabled : pagination.current == pagination.last }"><a href="" ng-click="setCurrent(pagination.last)">&raquo;</a></li></ul>');
    }

    class PaginateDirective implements ng.IDirective {
        static terminal:boolean = true;
        static multiElement:boolean = true;
        static priority:number = 100;

        compile:IDirectiveCompileFn;
        expression:any;
        collectionGetter:ICompiledExpression;

        constructor(private $compile:ng.ICompileService, private $parse:ng.IParseService, private paginationService:PaginationService) {
            this.compile = this.paginationCompileFn();
        }

        static factory():ng.IDirectiveFactory {
            const directive = ($compile:ng.ICompileService, $parse:ng.IParseService, paginationService:PaginationService) =>
                new PaginateDirective($compile, $parse, paginationService);
            directive.$inject = ['$compile', '$parse', 'paginationService'];
            return directive;
        }

        paginationCompileFn():IDirectiveCompileFn {
            return (tElement:IAugmentedJQuery, tAttrs:IAttributes) => {
                this.expression = tAttrs['paginate'];
                // regex taken directly from https://github.com/angular/angular.js/blob/v1.4.x/src/ng/directive/ngRepeat.js#L339
                var match = this.expression.match(/^\s*([\s\S]+?)\s+in\s+([\s\S]+?)(?:\s+as\s+([\s\S]+?))?(?:\s+track\s+by\s+([\s\S]+?))?\s*$/);

                var filterPattern = /\|\s*itemsPerPage\s*:\s*(.*\(\s*\w*\)|([^\)]*?(?=\s+as\s+))|[^\)]*)/;
                if (match[2].match(filterPattern) === null) {
                    throw 'pagination directive: the \'itemsPerPage\' filter must be set.';
                }
                var itemsPerPageFilterRemoved = match[2].replace(filterPattern, '');
                this.collectionGetter = this.$parse(itemsPerPageFilterRemoved);

                this.addNoCompileAttributes(tElement);

                // If any value is specified for paginationId, we register the un-evaluated expression at this stage for the benefit of any
                // pagination-controls directives that may be looking for this ID.
                var rawId = tAttrs['paginationId'] || DEFAULT_ID;
                this.paginationService.registerInstance(rawId);

                return (scope:IScope, element:IAugmentedJQuery, attrs:IAttributes) => {

                    // Now that we have access to the `scope` we can interpolate any expression given in the paginationId attribute and
                    // potentially register a new ID if it evaluates to a different value than the rawId.
                    var paginationId = this.$parse(attrs['paginationId'])(scope) || attrs['paginationId'] || DEFAULT_ID;

                    // (TODO: this seems sound, but I'm reverting as many bug reports followed it's introduction in 0.11.0.
                    // Needs more investigation.)
                    // In case rawId != paginationId we deregister using rawId for the sake of general cleanliness
                    // before registering using paginationId
                    // paginationService.deregisterInstance(rawId);
                    this.paginationService.registerInstance(paginationId);

                    var repeatExpression = this.getRepeatExpression(this.expression, paginationId);
                    this.addNgRepeatToElement(element, attrs, repeatExpression);

                    this.removeTemporaryAttributes(element);
                    var compiled = this.$compile(element);

                    var currentPageGetter = this.makeCurrentPageGetterFn(scope, attrs, paginationId);
                    this.paginationService.setCurrentPageParser(paginationId, currentPageGetter, scope);

                    if (typeof attrs['totalItems'] !== 'undefined') {
                        this.paginationService.setAsyncModeTrue(paginationId);
                        scope.$watch(() => {
                            return this.$parse(attrs['totalItems'])(scope);
                        }, (result) => {
                            if (0 <= result) {
                                this.paginationService.setCollectionLength(paginationId, result);
                            }
                        });
                    } else {
                        this.paginationService.setAsyncModeFalse(paginationId);
                        scope.$watchCollection(() => {
                            return this.collectionGetter(scope);
                        }, (collection) => {
                            if (collection) {
                                var collectionLength = (collection instanceof Array) ? collection.length : Object.keys(collection).length;
                                this.paginationService.setCollectionLength(paginationId, collectionLength);
                            }
                        });
                    }

                    // Delegate to the link function returned by the new compilation of the ng-repeat
                    compiled(scope);

                    // (TODO: Reverting this due to many bug reports in v 0.11.0. Needs investigation as the
                    // principle is sound)
                    // When the scope is destroyed, we make sure to remove the reference to it in paginationService
                    // so that it can be properly garbage collected
                    // scope.$on('$destroy', function destroyPagination() {
                    //     paginationService.deregisterInstance(paginationId);
                    // });
                };
            }
        }

        /**
         * If a pagination id has been specified, we need to check that it is present as the second argument passed to
         * the itemsPerPage filter. If it is not there, we add it and return the modified expression.
         *
         * @param expression
         * @param paginationId
         * @returns {*}
         */
        getRepeatExpression(expression, paginationId) {
            var repeatExpression,
                idDefinedInFilter = !!expression.match(/(\|\s*itemsPerPage\s*:[^|]*:[^|]*)/);

            if (paginationId !== DEFAULT_ID && !idDefinedInFilter) {
                repeatExpression = expression.replace(/(\|\s*itemsPerPage\s*:\s*[^|\s]*)/, "$1 : '" + paginationId + "'");
            } else {
                repeatExpression = expression;
            }

            return repeatExpression;
        }

        /**
         * Adds the ng-repeat directive to the element. In the case of multi-element (-start, -end) it adds the
         * appropriate multi-element ng-repeat to the first and last element in the range.
         * @param element
         * @param attrs
         * @param repeatExpression
         */
        addNgRepeatToElement(element, attrs, repeatExpression) {
            if (element[0].hasAttribute('paginate-start') || element[0].hasAttribute('data-paginate-start')) {
                // using multiElement mode (paginate-start, paginate-end)
                attrs.$set('ngRepeatStart', repeatExpression);
                element.eq(element.length - 1).attr('ng-repeat-end', true);
            } else {
                attrs.$set('ngRepeat', repeatExpression);
            }
        }

        /**
         * Adds the paginate-no-compile directive to each element in the tElement range.
         * @param tElement
         */
        addNoCompileAttributes(tElement) {
            angular.forEach(tElement, function (el) {
                if (el.nodeType === 1) {
                    // Previous implementation called jQuery's attr method passing in boolean.
                    // no such implementation exists.
                    // angular.element(el).attr('paginate-no-compile', true);
                    angular.element(el).attr('paginate-no-compile');
                }
            });
        }

        /**
         * Removes the variations on paginate (data-, -start, -end) and the paginate-no-compile directives.
         * @param element
         */
        removeTemporaryAttributes(element) {
            angular.forEach(element, function (el) {
                if (el.nodeType === 1) {
                    angular.element(el).removeAttr('paginate-no-compile');
                }
            });
            element.eq(0).removeAttr('paginate-start').removeAttr('paginate').removeAttr('data-paginate-start').removeAttr('data-paginate');
            element.eq(element.length - 1).removeAttr('paginate-end').removeAttr('data-paginate-end');
        }

        /**
         * Creates a getter function for the current-page attribute, using the expression provided or a default value if
         * no current-page expression was specified.
         *
         * @param scope
         * @param attrs
         * @param paginationId
         * @returns {*}
         */
        makeCurrentPageGetterFn(scope, attrs, paginationId) {
            var currentPageGetter;
            if (attrs.currentPage) {
                currentPageGetter = this.$parse(attrs.currentPage);
            } else {
                // If the current-page attribute was not set, we'll make our own.
                // Replace any non-alphanumeric characters which might confuse
                // the $parse service and give unexpected results.
                // See https://github.com/michaelbromley/angularUtils/issues/233
                var defaultCurrentPage = (paginationId + '__currentPage').replace(/\W/g, '_');
                scope[defaultCurrentPage] = 1;
                currentPageGetter = this.$parse(defaultCurrentPage);
            }
            return currentPageGetter;
        }
    }

    class PaginationControls implements ng.IDirective {
        numberRegex = /^\d+$/;

        DDO:IDirective = {
            restrict: 'AE',
            scope: {
                maxSize: '=?',
                onPageChange: '&?',
                paginationId: '=?',
                autoHide: '=?'
            },
            link: this.paginationControlsLinkFn
        };

        constructor(private paginationService:PaginationService, private paginationTemplate:PaginationTemplate) {
            // We need to check the paginationTemplate service to see whether a template path or
            // string has been specified, and add the `template` or `templateUrl` property to
            // the DDO as appropriate. The order of priority to decide which template to use is
            // (highest priority first):
            // 1. paginationTemplate.getString()
            // 2. attrs.templateUrl
            // 3. paginationTemplate.getPath()
            var templateString = this.paginationTemplate.getString();

            if (templateString !== undefined) {
                this.DDO.template = templateString;
            }
            else {
                this.DDO.templateUrl = function (elem, attrs) {
                    return attrs.templateUrl || this.paginationTemplate.$get.getPath();
                };
            }
        }

        static factory():ng.IDirectiveFactory {
            const directive = (paginationService:PaginationService, paginationTemplate:PaginationTemplate) =>
                new PaginationControls(paginationService, paginationTemplate);
            directive.$inject = ['paginationService', 'paginationTemplate'];
            return directive;
        }

        paginationControlsLinkFn(scope, attrs) {

            // rawId is the un-interpolated value of the pagination-id attribute. This is only important when the corresponding paginate directive has
            // not yet been linked (e.g. if it is inside an ng-if block), and in that case it prevents this controls directive from assuming that there is
            // no corresponding paginate directive and wrongly throwing an exception.
            var rawId = attrs.paginationId || DEFAULT_ID;
            var paginationId = scope.paginationId || attrs.paginationId || DEFAULT_ID;

            if (!this.paginationService.isRegistered(paginationId) && !this.paginationService.isRegistered(rawId)) {
                var idMessage = (paginationId !== DEFAULT_ID) ? ' (id: ' + paginationId + ') ' : ' ';
                if (window.console) {
                    console.warn('Pagination directive: the pagination controls' + idMessage + 'cannot be used without the corresponding pagination directive, which was not found at link time.');
                }
            }

            if (!scope.maxSize) {
                scope.maxSize = 9;
            }
            scope.autoHide = scope.autoHide === undefined ? true : scope.autoHide;
            scope.directionLinks = angular.isDefined(attrs.directionLinks) ? scope.$parent.$eval(attrs.directionLinks) : true;
            scope.boundaryLinks = angular.isDefined(attrs.boundaryLinks) ? scope.$parent.$eval(attrs.boundaryLinks) : false;

            var paginationRange = Math.max(scope.maxSize, 5);
            scope.pages = [];
            scope.pagination = {
                last: 1,
                current: 1
            };
            scope.range = {
                lower: 1,
                upper: 1,
                total: 1
            };

            scope.$watch('maxSize', function (val) {
                if (val) {
                    paginationRange = Math.max(scope.maxSize, 5);
                    generatePagination();
                }
            });

            scope.$watch(function () {
                if (this.paginationService.isRegistered(paginationId)) {
                    return (this.paginationService.getCollectionLength(paginationId) + 1) * this.paginationService.getItemsPerPage(paginationId);
                }
            }, function (length) {
                if (0 < length) {
                    generatePagination();
                }
            });

            scope.$watch(function () {
                if (this.paginationService.isRegistered(paginationId)) {
                    return (this.paginationService.getItemsPerPage(paginationId));
                }
            }, function (current, previous) {
                if (current != previous && typeof previous !== 'undefined') {
                    goToPage(scope.pagination.current);
                }
            });

            scope.$watch(function () {
                if (this.paginationService.isRegistered(paginationId)) {
                    return this.paginationService.getCurrentPage(paginationId);
                }
            }, function (currentPage, previousPage) {
                if (currentPage != previousPage) {
                    goToPage(currentPage);
                }
            });

            scope.setCurrent = function (num) {
                if (this.paginationService.isRegistered(paginationId) && isValidPageNumber(num)) {
                    num = parseInt(num, 10);
                    this.paginationService.setCurrentPage(paginationId, num);
                }
            };

            /**
             * Custom "track by" function which allows for duplicate "..." entries on long lists,
             * yet fixes the problem of wrongly-highlighted links which happens when using
             * "track by $index" - see https://github.com/michaelbromley/angularUtils/issues/153
             * @param id
             * @param index
             * @returns {string}
             */
            scope.tracker = function (id, index) {
                return id + '_' + index;
            };

            function goToPage(num) {
                if (this.paginationService.isRegistered(paginationId) && isValidPageNumber(num)) {
                    var oldPageNumber = scope.pagination.current;

                    scope.pages = this.generatePagesArray(num, this.paginationService.getCollectionLength(paginationId), this.paginationService.getItemsPerPage(paginationId), paginationRange);
                    scope.pagination.current = num;
                    updateRangeValues();

                    // if a callback has been set, then call it with the page number as the first argument
                    // and the previous page number as a second argument
                    if (scope.onPageChange) {
                        scope.onPageChange({
                            newPageNumber: num,
                            oldPageNumber: oldPageNumber
                        });
                    }
                }
            }

            function generatePagination() {
                if (this.paginationService.isRegistered(paginationId)) {
                    var page = parseInt(this.paginationService.getCurrentPage(paginationId)) || 1;
                    scope.pages = this.generatePagesArray(page, this.paginationService.getCollectionLength(paginationId), this.paginationService.getItemsPerPage(paginationId), paginationRange);
                    scope.pagination.current = page;
                    scope.pagination.last = scope.pages[scope.pages.length - 1];
                    if (scope.pagination.last < scope.pagination.current) {
                        scope.setCurrent(scope.pagination.last);
                    } else {
                        updateRangeValues();
                    }
                }
            }

            /**
             * This function updates the values (lower, upper, total) of the `scope.range` object, which can be used in the pagination
             * template to display the current page range, e.g. "showing 21 - 40 of 144 results";
             */
            function updateRangeValues() {
                if (this.paginationService.isRegistered(paginationId)) {
                    var currentPage = this.paginationService.getCurrentPage(paginationId),
                        itemsPerPage = this.paginationService.getItemsPerPage(paginationId),
                        totalItems = this.paginationService.getCollectionLength(paginationId);

                    scope.range.lower = (currentPage - 1) * itemsPerPage + 1;
                    scope.range.upper = Math.min(currentPage * itemsPerPage, totalItems);
                    scope.range.total = totalItems;
                }
            }

            function isValidPageNumber(num) {
                return (this.numberRegex.test(num) && (0 < num && num <= scope.pagination.last));
            }
        }

        /**
         * Generate an array of page numbers (or the '...' string) which is used in an ng-repeat to generate the
         * links used in pagination
         *
         * @param currentPage
         * @param rowsPerPage
         * @param paginationRange
         * @param collectionLength
         * @returns {Array}
         */
        generatePagesArray(currentPage, collectionLength, rowsPerPage, paginationRange) {
            var pages = [];
            var totalPages = Math.ceil(collectionLength / rowsPerPage);
            var halfWay = Math.ceil(paginationRange / 2);
            var position;

            if (currentPage <= halfWay) {
                position = 'start';
            } else if (totalPages - halfWay < currentPage) {
                position = 'end';
            } else {
                position = 'middle';
            }

            var ellipsesNeeded = paginationRange < totalPages;
            var i = 1;
            while (i <= totalPages && i <= paginationRange) {
                var pageNumber = this.calculatePageNumber(i, currentPage, paginationRange, totalPages);

                var openingEllipsesNeeded = (i === 2 && (position === 'middle' || position === 'end'));
                var closingEllipsesNeeded = (i === paginationRange - 1 && (position === 'middle' || position === 'start'));
                if (ellipsesNeeded && (openingEllipsesNeeded || closingEllipsesNeeded)) {
                    pages.push('...');
                } else {
                    pages.push(pageNumber);
                }
                i++;
            }
            return pages;
        }

        /**
         * Given the position in the sequence of pagination links [i], figure out what page number corresponds to that position.
         *
         * @param i
         * @param currentPage
         * @param paginationRange
         * @param totalPages
         * @returns {*}
         */
        calculatePageNumber(i, currentPage, paginationRange, totalPages) {
            var halfWay = Math.ceil(paginationRange / 2);
            if (i === paginationRange) {
                return totalPages;
            } else if (i === 1) {
                return i;
            } else if (paginationRange < totalPages) {
                if (totalPages - halfWay < currentPage) {
                    return totalPages - paginationRange + i;
                } else if (halfWay < currentPage) {
                    return currentPage - halfWay + i;
                } else {
                    return i;
                }
            } else {
                return i;
            }
        }
    }

    /**
     * Shim for the Object.keys() method which does not exist in IE < 9
     * @param obj
     * @returns {Array}
     */
    function keys(obj) {
        if (!Object.keys) {
            var objKeys = [];
            for (var i in obj) {
                if (obj.hasOwnProperty(i)) {
                    objKeys.push(i);
                }
            }
            return objKeys;
        } else {
            return Object.keys(obj);
        }
    }

    angularUtilsModule.factory('paginationService', () => {
        return new PaginationService();
    });

    angularUtilsModule.filter('itemsPerPage', ItemsPerPage);

    angularUtilsModule.provider('paginationTemplate', () => {
        return new PaginationTemplate();
    });

    angularUtilsModule.run(['$templateCache', PaginationControlsTemplateInstaller]);

    angularUtilsModule.directive('paginate', PaginateDirective.factory());

    angularUtilsModule.directive('paginationControls', PaginationControls.factory());

    /**
     * This is a helper directive that allows correct compilation when in multi-element mode (ie paginate-start, paginate-end).
     * It is dynamically added to all elements in the paginate compile function, and it prevents further compilation of
     * any inner directives. It is then removed in the link function, and all inner directives are then manually compiled.
     */
    angularUtilsModule.directive('paginateNoCompile', [function () {
        return {
            priority: 5000,
            terminal: true
        };
    }]);

}
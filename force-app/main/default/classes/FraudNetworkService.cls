public with sharing class FraudNetworkService {
    // Heuristic thresholds for coordinated review detection
    private static final Integer BURST_MIN_REVIEWS = 3;
    private static final Integer BURST_MIN_REVIEWERS = 3;
    private static final Integer BURST_WINDOW_HOURS = 12;
    private static final Long BURST_WINDOW_MILLIS = 12L * 60L * 60L * 1000L;
    private static final Integer UNIFORM_RATING_THRESHOLD = 3;
    private static final Integer CROSS_PROPERTY_THRESHOLD = 3;
    private static final Integer CROSS_PROPERTY_WINDOW_DAYS = 14;
    private static final Integer SHARED_REVIEWER_THRESHOLD = 2;
    private static final Decimal BURST_EDGE_WEIGHT = 0.7;
    private static final Decimal UNIFORM_RATING_EDGE_WEIGHT = 0.4;
    private static final Decimal SHARED_REVIEWER_EDGE_WEIGHT = 0.3;

    public class NetworkRequest {
        @AuraEnabled public List<Id> propertyIds;
        @AuraEnabled public Integer lookbackDays;
    }

    public class Node {
        @AuraEnabled public String id;
        @AuraEnabled public String type; // reviewer or property
        @AuraEnabled public String label;
        @AuraEnabled public Decimal score;
        @AuraEnabled public List<String> reasons;
    }

    public class Edge {
        @AuraEnabled public String source;
        @AuraEnabled public String target;
        @AuraEnabled public Decimal weight;
        @AuraEnabled public String reason;
    }

    public class ClusterSummary {
        @AuraEnabled public String clusterId;
        @AuraEnabled public Decimal riskScore;
        @AuraEnabled public Integer reviewerCount;
        @AuraEnabled public Integer propertyCount;
        @AuraEnabled public Integer reviewCount;
        @AuraEnabled public List<String> reasons;
    }

    public class NetworkResponse {
        @AuraEnabled public List<Node> nodes;
        @AuraEnabled public List<Edge> edges;
        @AuraEnabled public List<ClusterSummary> clusters;
    }

    @AuraEnabled(cacheable=true)
    public static NetworkResponse buildNetwork(NetworkRequest request) {
        if (request == null || request.propertyIds == null || request.propertyIds.isEmpty()) {
            throw new AuraHandledException('At least one property is required.');
        }
        Integer lookback = request.lookbackDays != null ? request.lookbackDays : 90;
        Datetime cutoff = Datetime.now().addDays(-lookback);

        List<Property_Review__c> reviews = [
            SELECT Id, Property__c, Rating__c, Comment__c, CreatedDate, Reviewer__c, Reviewer_Email__c, Reviewer_Hash__c
            FROM Property_Review__c
            WHERE Property__c IN :request.propertyIds
              AND CreatedDate >= :cutoff
            ORDER BY CreatedDate DESC
            LIMIT 5000
        ];

        NetworkBuilder builder = new NetworkBuilder(reviews);
        builder.build();
        return builder.toResponse();
    }

    private class NetworkBuilder {
        List<Property_Review__c> reviews;
        Map<String, Node> nodes = new Map<String, Node>();
        List<Edge> edges = new List<Edge>();
        Map<String, Set<String>> adjacency = new Map<String, Set<String>>();
        Map<String, ClusterSummary> clusterSummaries = new Map<String, ClusterSummary>();
        Integer clusterSequence = 0;
        Map<String, List<Property_Review__c>> reviewsByProperty = new Map<String, List<Property_Review__c>>();
        Map<String, List<Property_Review__c>> reviewsByReviewerKey = new Map<String, List<Property_Review__c>>();

        NetworkBuilder(List<Property_Review__c> reviews) {
            this.reviews = reviews;
        }

        void build() {
            Map<String, List<Property_Review__c>> byReviewer = groupByReviewer();
            reviewsByReviewerKey = byReviewer;
            Map<String, List<Property_Review__c>> byHash = groupBySignature();
            reviewsByProperty = groupByProperty();

            for (String reviewerKey : byReviewer.keySet()) {
                ensureReviewerNode(reviewerKey, byReviewer.get(reviewerKey));
            }
            for (Property_Review__c review : reviews) {
                ensurePropertyNode(review.Property__c);
            }

            connectReviewerProperty(byReviewer);
            analyzeSimilarity(byHash);
            detectCrossPropertyActivity();
            detectRatingUniformity();
            detectBursts();
            runClustering();
        }

        Map<String, List<Property_Review__c>> groupByReviewer() {
            Map<String, List<Property_Review__c>> map = new Map<String, List<Property_Review__c>>();
            for (Property_Review__c review : reviews) {
                String key = review.Reviewer_Hash__c;
                if (String.isBlank(key)) {
                    key = String.isBlank(review.Reviewer_Email__c) ? 'anon-' + review.Reviewer__c : review.Reviewer_Email__c.toLowerCase();
                }
                if (!map.containsKey(key)) {
                    map.put(key, new List<Property_Review__c>());
                }
                map.get(key).add(review);
            }
            return map;
        }

        Map<String, List<Property_Review__c>> groupBySignature() {
            Map<String, List<Property_Review__c>> map = new Map<String, List<Property_Review__c>>();
            for (Property_Review__c review : reviews) {
                String signature = ReviewFraudService.computeSignature((review.Comment__c == null ? '' : review.Comment__c));
                if (String.isBlank(signature)) {
                    continue;
                }
                if (!map.containsKey(signature)) {
                    map.put(signature, new List<Property_Review__c>());
                }
                map.get(signature).add(review);
            }
            return map;
        }

        Map<String, List<Property_Review__c>> groupByProperty() {
            Map<String, List<Property_Review__c>> map = new Map<String, List<Property_Review__c>>();
            for (Property_Review__c review : reviews) {
                if (review.Property__c == null) {
                    continue;
                }
                String key = (String)review.Property__c;
                if (!map.containsKey(key)) {
                    map.put(key, new List<Property_Review__c>());
                }
                map.get(key).add(review);
            }
            return map;
        }

        void ensureReviewerNode(String reviewerKey, List<Property_Review__c> reviewerReviews) {
            if (nodes.containsKey(reviewerKey)) {
                return;
            }
            Node node = new Node();
            node.id = reviewerKey;
            node.type = 'reviewer';
            node.label = reviewerKey;
            node.score = reviewerReviews.size();
            node.reasons = new List<String>();
            nodes.put(node.id, node);
        }

        void ensurePropertyNode(Id propertyId) {
            if (propertyId == null) {
                return;
            }
            String key = 'prop-' + propertyId;
            if (nodes.containsKey(key)) {
                return;
            }
            Node node = new Node();
            node.id = key;
            node.type = 'property';
            node.label = (String)propertyId;
            node.score = 0;
            node.reasons = new List<String>();
            nodes.put(node.id, node);
        }

        void connectReviewerProperty(Map<String, List<Property_Review__c>> byReviewer) {
            for (String reviewerKey : byReviewer.keySet()) {
                List<Property_Review__c> reviewerReviews = byReviewer.get(reviewerKey);
                if (reviewerReviews == null || reviewerReviews.isEmpty()) {
                    continue;
                }
                Set<Id> properties = new Set<Id>();
                for (Property_Review__c review : reviewerReviews) {
                    if (review.Property__c != null) {
                        properties.add(review.Property__c);
                    }
                }
                if (properties.isEmpty()) {
                    continue;
                }
                for (Id propertyId : properties) {
                    Edge edge = new Edge();
                    edge.source = reviewerKey;
                    edge.target = 'prop-' + propertyId;
                    edge.weight = Decimal.valueOf(reviewerReviews.size());
                    edge.reason = 'Reviewer posted ' + reviewerReviews.size() + ' reviews';
                    edges.add(edge);
                    link(edge.source, edge.target);
                }
            }
        }

        void analyzeSimilarity(Map<String, List<Property_Review__c>> bySignature) {
            for (String signature : bySignature.keySet()) {
                List<Property_Review__c> matches = bySignature.get(signature);
                if (matches.size() < 2) {
                    continue;
                }
                for (Integer i = 0; i < matches.size(); i++) {
                    for (Integer j = i + 1; j < matches.size(); j++) {
                        Property_Review__c a = matches[i];
                        Property_Review__c b = matches[j];
                        String reviewerA = resolveReviewerKey(a);
                        String reviewerB = resolveReviewerKey(b);
                        if (String.isBlank(reviewerA) || String.isBlank(reviewerB) || reviewerA == reviewerB) {
                            continue;
                        }
                        Edge edge = new Edge();
                        edge.source = reviewerA;
                        edge.target = reviewerB;
                        edge.weight = 0.5;
                        edge.reason = 'Similar wording detected';
                        edges.add(edge);
                        link(edge.source, edge.target);
                    }
                }
            }
        }

        void detectCrossPropertyActivity() {
            Map<String, Set<String>> reviewerToProperties = new Map<String, Set<String>>();
            for (String reviewerKey : reviewsByReviewerKey.keySet()) {
                List<Property_Review__c> listReviews = reviewsByReviewerKey.get(reviewerKey);
                if (listReviews == null || listReviews.isEmpty()) {
                    continue;
                }
                for (Property_Review__c review : listReviews) {
                    if (review.Property__c == null) {
                        continue;
                    }
                    String propertyKey = 'prop-' + review.Property__c;
                    if (!reviewerToProperties.containsKey(reviewerKey)) {
                        reviewerToProperties.put(reviewerKey, new Set<String>());
                    }
                    reviewerToProperties.get(reviewerKey).add(propertyKey);
                }
                if (reviewerToProperties.get(reviewerKey).size() >= CROSS_PROPERTY_THRESHOLD) {
                    Node reviewerNode = nodes.get(reviewerKey);
                    if (reviewerNode != null) {
                        reviewerNode.reasons.add('Reviewed ' + reviewerToProperties.get(reviewerKey).size() + ' properties in last period');
                        reviewerNode.score += 1;
                    }
                }
            }

            // Connect properties that share suspicious reviewer overlap
            List<String> propertyKeys = new List<String>(reviewsByProperty.keySet());
            for (Integer i = 0; i < propertyKeys.size(); i++) {
                for (Integer j = i + 1; j < propertyKeys.size(); j++) {
                    String propA = propertyKeys[i];
                    String propB = propertyKeys[j];
                    Set<String> reviewersA = getReviewersForProperty(propA);
                    Set<String> reviewersB = getReviewersForProperty(propB);
                    Set<String> intersection = new Set<String>(reviewersA);
                    intersection.retainAll(reviewersB);
                    if (intersection.size() >= SHARED_REVIEWER_THRESHOLD) {
                        Edge edge = new Edge();
                        edge.source = 'prop-' + propA;
                        edge.target = 'prop-' + propB;
                        edge.weight = SHARED_REVIEWER_EDGE_WEIGHT;
                        edge.reason = 'Shared reviewers (' + intersection.size() + ')';
                        edges.add(edge);
                        link(edge.source, edge.target);
                        Node propertyNodeA = nodes.get('prop-' + propA);
                        Node propertyNodeB = nodes.get('prop-' + propB);
                        if (propertyNodeA != null) {
                            propertyNodeA.reasons.add('Shares reviewers with ' + propB);
                            propertyNodeA.score += 0.2;
                        }
                        if (propertyNodeB != null) {
                            propertyNodeB.reasons.add('Shares reviewers with ' + propA);
                            propertyNodeB.score += 0.2;
                        }
                    }
                }
            }
        }

        Set<String> getReviewersForProperty(String propertyKeyWithoutPrefix) {
            Set<String> reviewers = new Set<String>();
            List<Property_Review__c> propertyReviews = reviewsByProperty.get(propertyKeyWithoutPrefix);
            if (propertyReviews == null) {
                return reviewers;
            }
            for (Property_Review__c review : propertyReviews) {
                String reviewerKey = resolveReviewerKey(review);
                if (String.isNotBlank(reviewerKey)) {
                    reviewers.add(reviewerKey);
                }
            }
            return reviewers;
        }

        void detectRatingUniformity() {
            for (String reviewerKey : reviewsByReviewerKey.keySet()) {
                List<Property_Review__c> listReviews = reviewsByReviewerKey.get(reviewerKey);
                if (listReviews == null || listReviews.size() < UNIFORM_RATING_THRESHOLD) {
                    continue;
                }
                Decimal firstRating = listReviews[0].Rating__c;
                Boolean allSame = true;
                for (Property_Review__c review : listReviews) {
                    if (review.Rating__c != firstRating) {
                        allSame = false;
                        break;
                    }
                }
                if (allSame) {
                    Node reviewerNode = nodes.get(reviewerKey);
                    if (reviewerNode != null) {
                        reviewerNode.reasons.add('Uniform rating pattern (' + String.valueOf(firstRating) + ')');
                        reviewerNode.score += 0.5;
                    }
                }
            }
        }

        void detectBursts() {
            // For each property, look for bursts of reviews within a short window
            for (String propertyKey : reviewsByProperty.keySet()) {
                List<Property_Review__c> propertyReviews = reviewsByProperty.get(propertyKey);
                if (propertyReviews == null || propertyReviews.size() < BURST_MIN_REVIEWS) {
                    continue;
                }
                propertyReviews.sort((a, b) => a.CreatedDate.compareTo(b.CreatedDate));

                Integer windowStartIndex = 0;
                while (windowStartIndex < propertyReviews.size()) {
                    Integer windowEndIndex = expandBurstWindow(propertyReviews, windowStartIndex);
                    Integer windowSize = windowEndIndex - windowStartIndex;
                    if (windowSize >= BURST_MIN_REVIEWS) {
                        processBurst(propertyKey, propertyReviews, windowStartIndex, windowEndIndex);
                    }
                    windowStartIndex = windowStartIndex + 1;
                }
            }
        }

        Integer expandBurstWindow(List<Property_Review__c> propertyReviews, Integer startIndex) {
            Datetime startTime = propertyReviews[startIndex].CreatedDate;
            Integer endIndex = startIndex + 1;
            while (endIndex < propertyReviews.size()) {
                Datetime current = propertyReviews[endIndex].CreatedDate;
                Long delta = Math.abs(current.getTime() - startTime.getTime());
                if (delta > BURST_WINDOW_MILLIS) {
                    break;
                }
                endIndex++;
            }
            return endIndex;
        }

        void processBurst(String propertyKey, List<Property_Review__c> reviews, Integer startIndex, Integer endIndex) {
            Integer count = endIndex - startIndex;
            Set<String> reviewerKeys = new Set<String>();
            for (Integer i = startIndex; i < endIndex; i++) {
                String reviewerKey = resolveReviewerKey(reviews[i]);
                if (String.isNotBlank(reviewerKey)) {
                    reviewerKeys.add(reviewerKey);
                }
            }
            if (reviewerKeys.size() < BURST_MIN_REVIEWERS) {
                return;
            }

            String propertyNodeKey = 'prop-' + propertyKey;
            Node propertyNode = nodes.get(propertyNodeKey);
            if (propertyNode != null) {
                propertyNode.reasons.add('Burst of ' + count + ' reviews within ' + BURST_WINDOW_HOURS + ' hours');
                propertyNode.score += 1;
            }

            List<String> reviewerList = new List<String>(reviewerKeys);
            for (Integer i = 0; i < reviewerList.size(); i++) {
                for (Integer j = i + 1; j < reviewerList.size(); j++) {
                    String reviewerA = reviewerList[i];
                    String reviewerB = reviewerList[j];
                    Edge edge = new Edge();
                    edge.source = reviewerA;
                    edge.target = reviewerB;
                    edge.weight = BURST_EDGE_WEIGHT;
                    edge.reason = 'Burst activity overlap (' + propertyKey + ')';
                    edges.add(edge);
                    link(edge.source, edge.target);
                }
            }
        }

        String resolveReviewerKey(Property_Review__c review) {
            if (String.isNotBlank(review.Reviewer_Hash__c)) {
                return review.Reviewer_Hash__c;
            }
            if (String.isNotBlank(review.Reviewer_Email__c)) {
                return review.Reviewer_Email__c.toLowerCase();
            }
            if (review.Reviewer__c != null) {
                return 'anon-' + review.Reviewer__c;
            }
            return null;
        }

        void link(String source, String target) {
            if (String.isBlank(source) || String.isBlank(target)) {
                return;
            }
            if (!adjacency.containsKey(source)) {
                adjacency.put(source, new Set<String>());
            }
            adjacency.get(source).add(target);
            if (!adjacency.containsKey(target)) {
                adjacency.put(target, new Set<String>());
            }
            adjacency.get(target).add(source);
        }

        void runClustering() {
            Set<String> visited = new Set<String>();
            for (String nodeId : nodes.keySet()) {
                if (!visited.contains(nodeId)) {
                    Set<String> component = new Set<String>();
                    dfs(nodeId, visited, component);
                    if (component.size() > 1) {
                        summarizeCluster(component);
                    }
                }
            }
        }

        void dfs(String nodeId, Set<String> visited, Set<String> component) {
            visited.add(nodeId);
            component.add(nodeId);
            for (String neighbor : getNeighbors(nodeId)) {
                if (!visited.contains(neighbor)) {
                    dfs(neighbor, visited, component);
                }
            }
        }

        Set<String> getNeighbors(String nodeId) {
            Set<String> neighbors = adjacency.containsKey(nodeId)
                ? adjacency.get(nodeId)
                : null;
            if (neighbors == null) {
                return new Set<String>();
            }
            return neighbors;
        }

        void summarizeCluster(Set<String> component) {
            ClusterSummary summary = new ClusterSummary();
            summary.clusterId = 'cluster-' + (++clusterSequence);
            summary.reviewerCount = 0;
            summary.propertyCount = 0;
            summary.reviewCount = 0;
            summary.reasons = new List<String>();
            Decimal risk = 0;

            for (String nodeId : component) {
                Node node = nodes.get(nodeId);
                if (node == null) {
                    continue;
                }
                if (node.type == 'reviewer') {
                    summary.reviewerCount++;
                    risk += node.score * 0.05;
                    if (node.reasons != null) {
                        summary.reasons.addAll(node.reasons);
                    }
                } else if (node.type == 'property') {
                    summary.propertyCount++;
                    if (node.reasons != null) {
                        summary.reasons.addAll(node.reasons);
                    }
                }
            }

            Set<String> reasons = new Set<String>();
            for (Edge edge : edges) {
                if (component.contains(edge.source) && component.contains(edge.target)) {
                    summary.reviewCount++;
                    if (edge.reason != null) {
                        reasons.add(edge.reason);
                    }
                    risk += edge.weight * 0.1;
                }
            }
            summary.reasons.addAll(new List<String>(reasons));
            if (risk > 1) {
                risk = 1;
            }
            summary.riskScore = risk.setScale(2);
            if (!summary.reasons.isEmpty()) {
                summary.reasons = new List<String>(new Set<String>(summary.reasons));
            }
            clusterSummaries.put(summary.clusterId, summary);
        }

        NetworkResponse toResponse() {
            NetworkResponse response = new NetworkResponse();
            response.nodes = new List<Node>(nodes.values());
            response.edges = edges;
            response.clusters = new List<ClusterSummary>(clusterSummaries.values());
            return response;
        }
    }
}

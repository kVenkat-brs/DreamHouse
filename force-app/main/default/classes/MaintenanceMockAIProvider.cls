public with sharing class MaintenanceMockAIProvider extends MaintenanceAIProvider {
    public override List<MaintenancePredictionService.MaintenanceAIResponse> analyzeReviews(List<Property_Review__c> reviews) {
        Map<String, Integer> categoryCounts = new Map<String, Integer>();
        Map<String, List<String>> categoryEvidence = new Map<String, List<String>>();

        for (Property_Review__c review : reviews) {
            List<String> categories = classifyReview(review.Comment__c);
            for (String category : categories) {
                categoryCounts.put(category, (categoryCounts.get(category) == null ? 0 : categoryCounts.get(category)) + 1);
                if (!categoryEvidence.containsKey(category)) {
                    categoryEvidence.put(category, new List<String>());
                }
                if (categoryEvidence.get(category).size() < 5) {
                    categoryEvidence.get(category).add(review.Comment__c);
                }
            }
        }

        List<MaintenancePredictionService.MaintenanceAIResponse> responses = new List<MaintenancePredictionService.MaintenanceAIResponse>();
        for (String category : categoryCounts.keySet()) {
            Integer occurrences = categoryCounts.get(category);
            MaintenancePredictionService.MaintenanceAIResponse response = new MaintenancePredictionService.MaintenanceAIResponse();
            response.category = category;
            response.riskScore = Math.min(1, Decimal.valueOf(occurrences) / 10);
            response.confidence = Math.min(1, Decimal.valueOf(reviews.size()) / 100);
            response.recommendation = buildRecommendation(category);
            response.evidence = categoryEvidence.get(category);
            response.windowStart = Date.today();
            response.windowEnd = Date.today().addDays(30);
            responses.add(response);
        }
        return responses;
    }

    private static List<String> classifyReview(String comment) {
        if (String.isBlank(comment)) {
            return new List<String>();
        }
        String lower = comment.toLowerCase();
        Map<String, List<String>> keywords = new Map<String, List<String>>{
            'HVAC' => new List<String>{'ac', 'air conditioning', 'heat', 'heater', 'hvac'},
            'Plumbing' => new List<String>{'leak', 'plumbing', 'water pressure', 'pipe', 'drain'},
            'Electrical' => new List<String>{'outlet', 'power', 'electrical', 'lights flicker'},
            'Appliances' => new List<String>{'appliance', 'fridge', 'dishwasher', 'washing machine', 'dryer', 'oven'},
            'Structural' => new List<String>{'roof', 'foundation', 'wall crack', 'structural'},
            'Cleanliness' => new List<String>{'dirty', 'stain', 'mold', 'smell', 'dust'},
            'Other' => new List<String>{'maintenance', 'fix', 'repair', 'broken'}
        };

        List<String> categories = new List<String>();
        for (String category : keywords.keySet()) {
            if (containsAny(lower, keywords.get(category))) {
                categories.add(category);
            }
        }
        return categories;
    }

    private static Boolean containsAny(String source, List<String> terms) {
        for (String term : terms) {
            if (source.contains(term)) {
                return true;
            }
        }
        return false;
    }

    private static String buildRecommendation(String category) {
        switch on category {
            when 'HVAC' {
                return 'Schedule HVAC inspection and replace filters; consider seasonal service contract.';
            }
            when 'Plumbing' {
                return 'Inspect plumbing fixtures, check for leaks, and plan preventative maintenance.';
            }
            when 'Electrical' {
                return 'Engage licensed electrician to evaluate wiring and resolve recurring issues.';
            }
            when 'Appliances' {
                return 'Audit appliance ages, repair or replace units with frequent complaints.';
            }
            when 'Structural' {
                return 'Conduct structural assessment focusing on reported areas; prioritize safety fixes.';
            }
            when 'Cleanliness' {
                return 'Increase housekeeping QA checks and deep-clean schedule.';
            }
            when else {
                return 'Review maintenance requests and plan targeted improvements.';
            }
        }
    }
}

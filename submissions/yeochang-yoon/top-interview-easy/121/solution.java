class Solution {
    public int maxProfit(int[] prices) {

        int minPrice = prices[0];
        int[] profit = new int[prices.length];
        profit[0] = 0;
        for(int i = 1; i < prices.length; i++){

            minPrice = Math.min(minPrice, prices[i]);
            profit[i] = Math.max(profit[i-1], prices[i] - minPrice);
        }

        return profit[prices.length-1];
    }
}
class Solution {
    public int maxProfit(int[] prices) {
        int rev = 0;
        for (int i = 0 ;i < prices.length; i++) {
            if (i < prices.length-1 && prices[i] < prices[i+1]) {
                rev += prices[i+1] - prices[i];
            }
        }
        return rev;
    }
}
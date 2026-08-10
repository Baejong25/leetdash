class Solution {


    public int solution(int sticker[]) {

        if (sticker.length == 1) {
            return sticker[0];
        }

        int n = sticker.length;
        int[] dp = new int[n];

        //0번을 선택한 세계 n-2까지 진행 n-1 선택 못함
        dp[0] = sticker[0];
        dp[1] = dp[0];

        for(int i = 2; i < n-1; i++){
            dp[i] = Math.max(sticker[i] + dp[i-2], dp[i-1]);
        }
        int max = dp[n-2];

        //0번을 버린 세계 n-1까지 진행
        dp[0] = 0;
        dp[1] = sticker[1];
        for(int i = 2; i < n; i++){
            dp[i] = Math.max(sticker[i] + dp[i-2], dp[i-1]);
        }

        max = Math.max(max, dp[n-1]);

        return max;
    }
}
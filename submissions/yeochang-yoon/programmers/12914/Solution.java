class Solution {
    public long solution(int n) {

        if(n == 1){
            return 1;
        }
        if(n == 2){
            return 2;
        }

        long prev2 = 1;
        long prev1 = 2;

        long current = 0;
        for(int i = 3; i <= n; i++){
            current = (prev2 + prev1) % 1234567;
            prev2 = prev1;
            prev1 = current;
        }

        return current;
    }
}
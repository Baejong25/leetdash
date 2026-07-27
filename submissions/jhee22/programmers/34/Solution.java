class Solution {
    public int solution(int n) {
        int answer = 0;
        int targetNum = (int) (Math.sqrt(n)) + 1; 
        for (int i = 1; i < targetNum; i++) {
            if (n % i == 0) {
                if (Math.pow(i, 2) == n) {
                    answer += 1;
                } else {
                    answer += 2; 
                } 
            }
        }
        return answer;
    }
}
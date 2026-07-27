class Solution {
    public int solution(int n) {
        int answer = 0;
        for (int num = 0; num <= n; num++) {
            if (num % 2 == 0){
                answer +=  num; 
            }
            
        }
        return answer;
    }
}
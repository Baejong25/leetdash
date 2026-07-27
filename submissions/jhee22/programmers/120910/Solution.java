class Solution {
    public int solution(int n, int t) {
        int answer = n; 
        int cnt = 0; 
        while (cnt < t) {
            answer *= 2; 
            cnt++; 
        }
        
        return answer; 
    }
}
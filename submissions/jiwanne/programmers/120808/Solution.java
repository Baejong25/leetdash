class Solution {
    public int[] solution(int numer1, int denom1, int numer2, int denom2) {
        int[] answer = new int [2];
        
        int n = numer1 * denom2 + numer2 * denom1;
        int d = denom1 * denom2;
        
        int gcd = 1;
        
        for(int i = 1; i <= n && i <= d; i++) {
            if(n % i == 0 && d % i == 0)
                gcd = i;
        }
        
        answer[0] = n / gcd;
        answer[1] = d / gcd;
        
        
        return answer;
    }
}
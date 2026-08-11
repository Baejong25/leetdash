class Solution {
    /*
    콜라 빈 병 a개 -> 콜라 b병
    cnt = n/a
    n = n/a + n%a 
    n이 a보다 작을 때까지 반복하도록
    
    
    */
    public int solution(int a, int b, int n) {
        int cnt = 0;
        while(n>=a){
            int exchange = n/a;
            cnt += exchange * b;
            n = exchange * b + n%a;
      }
        return cnt;
      
    }
}